import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { approveInboxItem, rejectInboxItem, getInboxItems } from '@/lib/ai/actions'

// GET /api/inbox
export async function GET(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const resolved = searchParams.get('resolved') === 'true'

  const items = await getInboxItems(business.id, resolved)
  const count = await db.inboxItem.count({
    where: { businessId: business.id, resolvedAt: null, dismissed: false },
  })

  return NextResponse.json({ items, count })
}

// POST /api/inbox - approve or reject
export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, itemId, reason } = await req.json()

  if (!itemId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Verify item belongs to this business
  const item = await db.inboxItem.findFirst({
    where: {
      id: itemId,
      business: { clerkOrgId: orgId },
    },
  })

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  if (action === 'approve') {
    await approveInboxItem(itemId, userId)
  } else {
    await rejectInboxItem(itemId, userId, reason)
  }

  return NextResponse.json({ success: true })
}
