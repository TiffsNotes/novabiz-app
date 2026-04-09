import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const business = await db.business.findFirst()
  if (!business) return NextResponse.json({ connected: false })
  const integration = await db.integration.findFirst({
    where: { businessId: business.id, type: 'gmail' },
  })
  if (!integration) return NextResponse.json({ connected: false })
  return NextResponse.json({ connected: true, status: integration.status, lastSyncAt: integration.lastSync })
}

export async function POST(req: NextRequest) {
  const { action } = await req.json()
  if (action === 'sync') return NextResponse.json({ success: true })
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const business = await db.business.findFirst()
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.integration.deleteMany({ where: { businessId: business.id, type: 'gmail' } })
  return NextResponse.json({ success: true })
}
