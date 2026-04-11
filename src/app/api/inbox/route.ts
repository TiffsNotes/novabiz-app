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

    const items = await db.agentAlert.findMany({
      where: { businessId: business.id, dismissed: false },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    })

    return NextResponse.json({
      items,
      pending: items.length,
      counts: {
        total: items.length,
        critical: items.filter(i => i.severity === 'critical').length,
        warning: items.filter(i => i.severity === 'warning').length,
        info: items.filter(i => i.severity === 'info').length,
        actionRequired: items.filter(i => i.actionRequired).length,
      }
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

    const { action, itemId } = await req.json()

    if (action === 'approve' || action === 'dismiss') {
      await db.agentAlert.update({
        where: { id: itemId },
        data: { dismissed: true, resolvedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'clear_all') {
      await db.agentAlert.updateMany({
        where: { businessId: business.id, dismissed: false, actionRequired: false },
        data: { dismissed: true, resolvedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
