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
    const view = new URL(req.url).searchParams.get('view') || 'contacts'
    if (view === 'contacts') {
      const contacts = await db.contact.findMany({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' }, take: 100 })
      return NextResponse.json({ contacts })
    }
    if (view === 'deals') {
      const deals = await db.deal.findMany({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { contact: true } })
      return NextResponse.json({ deals })
    }
    if (view === 'stats') {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const [totalContacts, openDeals, wonDeals, pipelineValue, newContactsMTD] = await Promise.all([
        db.contact.count({ where: { businessId: business.id } }),
        db.deal.count({ where: { businessId: business.id, status: 'open' } }),
        db.deal.aggregate({ where: { businessId: business.id, status: 'won', updatedAt: { gte: startOfMonth } }, _sum: { value: true }, _count: true }),
        db.deal.aggregate({ where: { businessId: business.id, status: 'open' }, _sum: { value: true } }),
        db.contact.count({ where: { businessId: business.id, createdAt: { gte: startOfMonth } } }),
      ])
      return NextResponse.json({ totalContacts, openDeals, wonDealsCount: wonDeals._count, wonRevenue: wonDeals._sum.value || 0, pipelineValue: pipelineValue._sum.value || 0, newContactsMTD })
    }
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  } catch (err: any) {
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
    const body = await req.json()
    const { action } = body
    if (action === 'create_contact') {
      const { displayName, email, phone, company, type = 'lead', notes } = body
      const contact = await db.contact.create({ data: { businessId: business.id, displayName, email, phone, company, type, notes, source: 'manual' } })
      return NextResponse.json({ success: true, contact })
    }
    if (action === 'create_deal') {
      const { title, value, stage = 'prospect', probability = 50, contactId, expectedCloseDate, notes } = body
      const deal = await db.deal.create({ data: { businessId: business.id, title, value: parseFloat(value), stage, status: 'open', probability, contactId: contactId || null, expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null, notes } })
      return NextResponse.json({ success: true, deal })
    }
    if (action === 'update_deal_stage') {
      await db.deal.update({ where: { id: body.dealId }, data: { stage: body.stage, status: body.status || 'open' } })
      return NextResponse.json({ success: true })
    }
    if (action === 'delete_contact') {
      await db.contact.delete({ where: { id: body.contactId } })
      return NextResponse.json({ success: true })
    }
    if (action === 'delete_deal') {
      await db.deal.delete({ where: { id: body.dealId } })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
