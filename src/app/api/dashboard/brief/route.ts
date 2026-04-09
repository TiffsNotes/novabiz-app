import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { generateDailyBrief } from '@/lib/ai/bi'

export async function GET() {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check for cached brief (generated in last 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
  const cached = await db.report.findFirst({
    where: { businessId: business.id, type: 'daily_brief', generatedAt: { gte: sixHoursAgo } },
  })

  if (cached) {
    return NextResponse.json({ brief: (cached.data as { brief: string }).brief })
  }

  const brief = await generateDailyBrief(business.id)

  await db.report.create({
    data: {
      businessId: business.id,
      type: 'daily_brief',
      period: new Date().toISOString().split('T')[0],
      data: { brief },
    },
  })

  return NextResponse.json({ brief })
}
