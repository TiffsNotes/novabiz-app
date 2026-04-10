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

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'
    const module = searchParams.get('module')

    const where: any = { businessId: business.id }
    if (status !== 'all') where.status = status
    if (module) where.module = module

    const [items, counts] = await Promise.all([
      db.inboxItem.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      db.inboxItem.groupBy({
        by: ['severity'],
        where: { businessId: business.id, status: 'pending' },
        _count: true,
      }),
    ])

    const severityCounts = counts.reduce((acc: any, c) => {
      acc[c.severity] = c._count
      return acc
    }, {})

    return NextResponse.json({
      items,
      counts: {
        total: items.length,
        critical: severityCounts.critical || 0,
        warning: severityCounts.warning || 0,
        info: severityCounts.info || 0,
      },
    })
  } catch (err: any) {
    console.error('Inbox API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { action, itemId, resolution } = await req.json()

    if (action === 'approve') {
      await db.inboxItem.update({
        where: { id: itemId },
        data: { status: 'approved', resolvedAt: new Date(), resolution },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'dismiss') {
      await db.inboxItem.update({
        where: { id: itemId },
        data: { status: 'dismissed', resolvedAt: new Date(), resolution },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'snooze') {
      await db.inboxItem.update({
        where: { id: itemId },
        data: { status: 'snoozed', snoozedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'clear_all') {
      await db.inboxItem.updateMany({
        where: { businessId: business.id, status: 'pending', actionRequired: false },
        data: { status: 'dismissed', resolvedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('Inbox POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
