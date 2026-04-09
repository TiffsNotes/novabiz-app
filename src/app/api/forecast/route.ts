import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const accounts = await db.bankAccount.findMany({ where: { businessId: business.id } }).catch(() => [])
    const currentCash = accounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [recentIncome, recentExpenses] = await Promise.all([
      db.transaction.aggregate({ where: { businessId: business.id, type: 'income', date: { gte: thirtyDaysAgo } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
      db.transaction.aggregate({ where: { businessId: business.id, type: 'expense', date: { gte: thirtyDaysAgo } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    ])
    const avgDailyIncome = Math.abs((recentIncome._sum.amount as number) || 0) / 30
    const avgDailyExpenses = Math.abs((recentExpenses._sum.amount as number) || 0) / 30
    const avgDailyNet = avgDailyIncome - avgDailyExpenses
    const forecast = []
    for (let day = 0; day <= 90; day += 7) {
      const date = new Date(now.getTime() + day * 24 * 60 * 60 * 1000)
      forecast.push({ date: date.toISOString().split('T')[0], projected: Math.max(0, currentCash + (avgDailyNet * day)) })
    }
    const upcomingBills = await db.bill.findMany({ where: { businessId: business.id, status: { in: ['open', 'partial'] }, dueDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } }, orderBy: { dueDate: 'asc' }, take: 10 }).catch(() => [])
    return NextResponse.json({ currentCash, accounts, forecast30: Math.max(0, currentCash + (avgDailyNet * 30)), forecast60: Math.max(0, currentCash + (avgDailyNet * 60)), forecast90: Math.max(0, currentCash + (avgDailyNet * 90)), avgDailyIncome, avgDailyExpenses, avgDailyNet, forecast, upcomingBills, generatedAt: now.toISOString() })
  } catch (err: any) {
    console.error('Forecast API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
