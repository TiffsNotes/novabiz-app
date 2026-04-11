import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []
      const now = new Date()
      const dayOfWeek = now.getDay()

      // Weekly content reminder on Mondays
      if (dayOfWeek === 1) {
        const _existing = await db.agentAlert.findFirst({ where: { businessId: business.id, type: "dedup", dismissed: false } }).catch(() => null); await db.agentAlert.create({
          data: {
            businessId: business.id,
            type: 'content_reminder',
            title: 'Weekly marketing content needed',
            description: 'Ask NOVA Growth to generate this weeks social media posts, email campaign, or ad copy. Consistent content drives 3x more leads.',
            severity: 'info',
            module: 'marketing',
            actionRequired: false,
            data: { week: now.toLocaleDateString() },
          },
        }).catch(() => null)
        actions.push('Weekly content reminder created')
      }

      // Monthly marketing budget review on 1st of month
      if (now.getDate() === 1) {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

        const monthlyAdSpend = await db.transaction.aggregate({
          where: {
            businessId: business.id,
            amount: { lt: 0 },
            date: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } }))

        const spend = Math.abs(Number(monthlyAdSpend._sum.amount) || 0)

        const _existing = await db.agentAlert.findFirst({ where: { businessId: business.id, type: "dedup", dismissed: false } }).catch(() => null); await db.agentAlert.create({
          data: {
            businessId: business.id,
            type: 'marketing_budget',
            title: 'Monthly marketing review: $' + (spend / 100).toFixed(0) + ' spent last month',
            description: 'Review last months marketing spend and ROI. Ask NOVA Growth to analyze which channels performed best and reallocate budget.',
            severity: 'info',
            module: 'marketing',
            actionRequired: false,
            data: { spend, month: startOfLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
          },
        }).catch(() => null)
        actions.push('Monthly marketing budget review created')
      }

      // Daily revenue check - flag if revenue is below average
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const [weekRevenue, yesterdayRevenue] = await Promise.all([
        db.transaction.aggregate({
          where: { businessId: business.id, amount: { gt: 0 }, date: { gte: sevenDaysAgo } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),
        db.transaction.aggregate({
          where: { businessId: business.id, amount: { gt: 0 }, date: { gte: yesterday, lt: now } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),
      ])

      const avgDailyRevenue = Math.abs(Number(weekRevenue._sum.amount) || 0) / 7
      const todayRevenue = Math.abs(Number(yesterdayRevenue._sum.amount) || 0)

      if (avgDailyRevenue > 0 && todayRevenue < avgDailyRevenue * 0.5) {
        const _existing = await db.agentAlert.findFirst({ where: { businessId: business.id, type: "dedup", dismissed: false } }).catch(() => null); await db.agentAlert.create({
          data: {
            businessId: business.id,
            type: 'revenue_alert',
            title: 'Revenue below average yesterday',
            description: 'Yesterday: $' + (todayRevenue / 100).toFixed(0) + ' vs 7-day avg: $' + (avgDailyRevenue / 100).toFixed(0) + '. Consider running a promotion or checking for operational issues.',
            severity: 'warning',
            module: 'marketing',
            actionRequired: false,
            data: { yesterdayRevenue: todayRevenue, avgDailyRevenue },
          },
        }).catch(() => null)
        actions.push('Revenue alert: below average')
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Growth agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
