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
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Weekly content reminder on Mondays
      if (dayOfWeek === 1) {
        await db.inboxItem.create({
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

      // Check campaign performance
      const activeCampaigns = await db.campaign.findMany({
        where: {
          businessId: business.id,
          status: 'sent',
          sentAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
      }).catch(() => [])

      if (activeCampaigns.length > 0) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'campaign_review',
            title: activeCampaigns.length + ' campaign(s) ready for performance review',
            description: 'Recent campaigns have been running for 7 days. Review open rates, click rates, and conversions to optimize future campaigns.',
            severity: 'info',
            module: 'marketing',
            actionRequired: false,
            data: { campaignIds: activeCampaigns.map(c => c.id) },
          },
        }).catch(() => null)
        actions.push('Campaign review reminder: ' + activeCampaigns.length + ' campaigns')
      }

      // Monthly marketing budget review
      if (now.getDate() === 1) {
        const monthlyAdSpend = await db.transaction.aggregate({
          where: {
            businessId: business.id,
            type: 'expense',
            category: 'Marketing',
            date: { gte: startOfMonth },
          },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } }))

        const spend = Math.abs((monthlyAdSpend._sum.amount as number) || 0)

        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'marketing_budget',
            title: 'Monthly marketing spend: $' + (spend / 100).toFixed(0),
            description: 'Review this months marketing spend and ROI. Ask NOVA Growth to analyze which channels are performing best and reallocate budget accordingly.',
            severity: 'info',
            module: 'marketing',
            actionRequired: false,
            data: { spend, month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
          },
        }).catch(() => null)
        actions.push('Monthly marketing budget review')
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Growth agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
