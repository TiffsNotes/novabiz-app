import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { runNOVAIntelligence, runQuickScan } from '@/lib/ai/intelligence'

// GET — fetch latest report (cached) or request new scan
export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const fresh = searchParams.get('fresh') === 'true'
  const quick = searchParams.get('quick') === 'true'

  // Quick scan for just critical/warning signals
  if (quick) {
    const signals = await runQuickScan(business.id)
    return NextResponse.json({ signals, count: signals.length })
  }

  // Check for cached report (within last 2 hours)
  if (!fresh) {
    const cached = await db.report.findFirst({
      where: {
        businessId: business.id,
        type: 'nova_intelligence',
        generatedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
      orderBy: { generatedAt: 'desc' },
    })
    if (cached) return NextResponse.json({ report: cached.data, cached: true })
  }

  // Run fresh scan
  const report = await runNOVAIntelligence(business.id)
  return NextResponse.json({ report, cached: false })
}

// POST — trigger immediate full scan
export async function POST(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const report = await runNOVAIntelligence(business.id)
  return NextResponse.json({ report })
}
