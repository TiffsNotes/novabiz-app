import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { buildReport } from '@/lib/ai/bi'

export async function POST(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { type, period } = await req.json()

  const report = await buildReport(business.id, { type, period })
  return NextResponse.json({ success: true, data: report.data, id: report.id })
}
