import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { generateForecast } from '@/lib/ai/forecast'

export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Try cached forecast first (generated within last 6 hours)
  const cached = await db.cashForecast.findMany({
    where: {
      businessId: business.id,
      generatedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      forecastDate: { gte: new Date() },
    },
    orderBy: { forecastDate: 'asc' },
    take: 90,
  })

  if (cached.length >= 30) {
    const accounts = await db.bankAccount.findMany({
      where: { businessId: business.id },
      select: { currentBalance: true, type: true },
    })
    const currentBalance = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + (a.currentBalance || 0), 0)
    const balance30 = cached[29]?.projectedBalance || currentBalance
    const balance90 = cached[cached.length - 1]?.projectedBalance || currentBalance
    const runwayPoint = cached.find(p => p.projectedBalance < 0)

    return NextResponse.json({
      currentBalance,
      balanceIn30Days: balance30,
      balanceIn90Days: balance90,
      runwayDays: runwayPoint ? cached.indexOf(runwayPoint) : null,
      alertLevel: balance30 < 0 ? 'critical' : balance30 < currentBalance * 0.2 ? 'warning' : 'ok',
      taxSetAside: Math.max(0, Math.round(currentBalance * 0.1)),
      points: cached.map(p => ({
        date: p.forecastDate.toISOString().split('T')[0],
        balance: p.projectedBalance,
        inflows: p.projectedInflows,
        outflows: p.projectedOutflows,
        confidenceLow: p.confidenceLow,
        confidenceHigh: p.confidenceHigh,
      })),
    })
  }

  // Generate fresh forecast
  const forecast = await generateForecast(business.id)
  return NextResponse.json(forecast)
}

export async function POST(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const forecast = await generateForecast(business.id)
  return NextResponse.json(forecast)
}
