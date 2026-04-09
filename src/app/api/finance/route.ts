import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { startOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const view = new URL(req.url).searchParams.get('view') || 'invoices'

  if (view === 'invoices') {
    const invoices = await db.invoice.findMany({
      where: { businessId: business.id },
      include: { contact: true, company: true },
      orderBy: { issueDate: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      invoices: invoices.map(i => ({
        id: i.id, number: i.number,
        client: i.company?.name || (i.contact ? `${i.contact.firstName} ${i.contact.lastName}` : 'Unknown'),
        amount: i.total, amountDue: i.amountDue, status: i.status,
        issueDate: i.issueDate, dueDate: i.dueDate, currency: i.currency,
      })),
    })
  }

  if (view === 'bills') {
    const bills = await db.bill.findMany({
      where: { businessId: business.id },
      include: { vendor: true },
      orderBy: { billDate: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      bills: bills.map(b => ({
        id: b.id, number: b.number,
        vendor: b.vendor?.name || 'Unknown',
        amount: b.total, amountPaid: b.amountPaid, status: b.status,
        billDate: b.billDate, dueDate: b.dueDate,
      })),
    })
  }

  if (view === 'ar_stats') {
    const now = new Date()
    const mtdStart = startOfMonth(now)
    const [outstanding, overdue, paidMtd] = await Promise.all([
      db.invoice.aggregate({
        where: { businessId: business.id, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
        _sum: { amountDue: true },
      }),
      db.invoice.aggregate({
        where: { businessId: business.id, status: 'OVERDUE' },
        _sum: { amountDue: true },
      }),
      db.payment.aggregate({
        where: { businessId: business.id, invoiceId: { not: null }, date: { gte: mtdStart } },
        _sum: { amount: true },
      }),
    ])
    return NextResponse.json({
      totalAR: outstanding._sum.amountDue || 0,
      overdue: overdue._sum.amountDue || 0,
      dueThisWeek: 0,
      paidThisMonth: paidMtd._sum.amount || 0,
    })
  }

  if (view === 'ap_stats') {
    const mtdStart = startOfMonth(new Date())
    const [outstanding, paidMtd] = await Promise.all([
      db.bill.aggregate({
        where: { businessId: business.id, status: { in: ['draft', 'approved'] }, paidAt: null },
        _sum: { total: true },
      }),
      db.payment.aggregate({
        where: { businessId: business.id, billId: { not: null }, date: { gte: mtdStart } },
        _sum: { amount: true },
      }),
    ])
    return NextResponse.json({
      totalAP: outstanding._sum.total || 0,
      overdue: 0,
      dueThisWeek: 0,
      paidThisMonth: paidMtd._sum.amount || 0,
    })
  }

  if (view === 'gl') {
    const entries = await db.journalEntry.findMany({
      where: { businessId: business.id },
      include: { lines: { include: { debitAccount: true, creditAccount: true } } },
      orderBy: { date: 'desc' },
      take: 50,
    })
    return NextResponse.json({ entries })
  }

  if (view === 'ledger_accounts') {
    const accounts = await db.ledgerAccount.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { code: 'asc' },
    })
    return NextResponse.json({ accounts })
  }

  if (view === 'tax_filings') {
    const filings = await db.taxFiling.findMany({
      where: { businessId: business.id },
      orderBy: { dueDate: 'asc' },
    })
    return NextResponse.json({ filings })
  }

  if (view === 'budgets') {
    const budgets = await db.budget.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ budgets })
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

  if (body.action === 'create_invoice') {
    const invoice = await db.invoice.create({
      data: {
        businessId: business.id,
        number: body.number || `INV-${Date.now()}`,
        subtotal: body.subtotal || 0,
        total: body.total || 0,
        amountDue: body.total || 0,
        lineItems: body.lineItems || [],
        ...body.data,
      },
    })
    return NextResponse.json(invoice)
  }

  if (body.action === 'record_payment') {
    const payment = await db.payment.create({
      data: {
        businessId: business.id,
        invoiceId: body.invoiceId,
        date: new Date(),
        amount: body.amount,
        method: body.method || 'bank_transfer',
      },
    })
    // Update invoice amount paid
    await db.invoice.update({
      where: { id: body.invoiceId },
      data: {
        amountPaid: { increment: body.amount },
        amountDue: { decrement: body.amount },
        status: body.fullyPaid ? 'PAID' : 'PARTIAL',
        paidAt: body.fullyPaid ? new Date() : undefined,
      },
    })
    return NextResponse.json(payment)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
