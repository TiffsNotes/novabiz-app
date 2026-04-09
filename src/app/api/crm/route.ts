import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { CRMAgent } from '@/lib/ai/crm'

export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') || 'contacts'

  if (view === 'contacts') {
    const contacts = await db.contact.findMany({
      where: { businessId: business.id, isActive: true },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      contacts: contacts.map(c => ({
        id: c.id, firstName: c.firstName, lastName: c.lastName,
        email: c.email, phone: c.phone, title: c.title,
        company: c.company?.name, stage: c.stage, score: c.score,
        createdAt: c.createdAt,
      })),
      total: contacts.length,
    })
  }

  if (view === 'deals') {
    const deals = await db.deal.findMany({
      where: { businessId: business.id, wonLost: null },
      include: { contact: true, company: true },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({
      deals: deals.map(d => ({
        id: d.id, name: d.name, value: d.value, stage: d.stage,
        probability: d.probability, contact: d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : undefined,
        company: d.company?.name, expectedClose: d.expectedClose,
        aiScore: d.aiScore, aiInsights: d.aiInsights,
      })),
    })
  }

  if (view === 'tickets') {
    const tickets = await db.supportTicket.findMany({
      where: { businessId: business.id },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({
      tickets: tickets.map(t => ({
        id: t.id, number: t.number, subject: t.subject,
        status: t.status, priority: t.priority,
        contact: t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : undefined,
        createdAt: t.createdAt,
      })),
    })
  }

  if (view === 'stats') {
    const agent = new CRMAgent(business.id)
    return NextResponse.json(await agent.getPipelineSummary())
  }

  return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { action } = body

  if (action === 'score_leads') {
    const agent = new CRMAgent(business.id)
    await agent.scoreLeads()
    return NextResponse.json({ success: true })
  }

  if (action === 'create_contact') {
    const contact = await db.contact.create({
      data: { businessId: business.id, ...body.data },
    })
    return NextResponse.json(contact)
  }

  if (action === 'create_deal') {
    const deal = await db.deal.create({
      data: { businessId: business.id, ...body.data },
    })
    return NextResponse.json(deal)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
