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
    const view = new URL(req.url).searchParams.get('view') || 'invoices'
    if (view === 'invoices') {
      const invoices = await db.invoice.findMany({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' }, take: 100 })
      return NextResponse.json({ invoices })
    }
    if (view === 'bills') {
      const bills = await db.bill.findMany({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' }, take: 100 })
      return NextResponse.json({ bills })
    }
    if (view === 'ar_stats') {
      const [total, overdue, collected] = await Promise.all([
        db.invoice.aggregate({ where: { businessId: business.id, status: { in: ['DRAFT', 'SENT', 'PARTIAL', 'OVERDUE'] } }, _sum: { total: true } }),
        db.invoice.aggregate({ where: { businessId: business.id, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, dueDate: { lt: new Date() } }, _sum: { total: true }, _count: true }),
        db.invoice.aggregate({ where: { businessId: business.id, status: 'PAID', updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { total: true } }),
      ])
      return NextResponse.json({ totalAR: (total._sum.total || 0) * 100, overdue: (overdue._sum.total || 0) * 100, dueThisWeek: 0, paidThisMonth: (collected._sum.total || 0) * 100 })
    }
    if (view === 'ap_stats') {
      const [total, overdue] = await Promise.all([
        db.bill.aggregate({ where: { businessId: business.id, status: { in: ['draft', 'open', 'partial'] } }, _sum: { total: true } }),
        db.bill.aggregate({ where: { businessId: business.id, status: { in: ['open', 'partial'] }, dueDate: { lt: new Date() } }, _sum: { total: true }, _count: true }),
      ])
      return NextResponse.json({ totalAP: (total._sum.total || 0) * 100, overdue: (overdue._sum.total || 0) * 100, dueThisWeek: 0, paidThisMonth: 0 })
    }
    if (view === 'tax_filings') {
      return NextResponse.json({ filings: [], nextDue: null })
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
    if (action === 'create_invoice') {
      const { customerName, customerEmail, dueDate, lineItems, notes } = body
      const subtotal = (lineItems || []).reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0)
      const invoiceNumber = 'INV-' + Date.now().toString().slice(-6)
      const invoice = await db.invoice.create({
        data: {
          businessId: business.id,
          number: invoiceNumber,
          customerName,
          customerEmail,
          issueDate: new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          subtotal,
          total: subtotal,
          amountDue: subtotal,
          lineItems: lineItems || [],
          status: 'DRAFT',
          notes,
        }
      })
      return NextResponse.json({ success: true, invoice })
    }
    if (action === 'create_bill') {
      const { vendorName, dueDate, total, lineItems, notes } = body
      const billNumber = 'BILL-' + Date.now().toString().slice(-6)
      const bill = await db.bill.create({
        data: {
          businessId: business.id,
          number: billNumber,
          vendorName,
          billDate: new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          subtotal: parseFloat(total) || 0,
          total: parseFloat(total) || 0,
          lineItems: lineItems || [],
          notes,
          status: 'draft',
        }
      })
      return NextResponse.json({ success: true, bill })
    }
    if (action === 'mark_paid') {
      const { type, id: recordId } = body
      if (type === 'invoice') {
        await db.invoice.update({ where: { id: recordId }, data: { status: 'PAID', amountDue: 0, paidAt: new Date() } })
      } else {
        await db.bill.update({ where: { id: recordId }, data: { status: 'paid', amountPaid: 0, paidAt: new Date() } })
      }
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
