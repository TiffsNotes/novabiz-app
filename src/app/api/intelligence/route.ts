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
    const quick = new URL(req.url).searchParams.get('quick') === 'true'
    if (quick) {
      const signals: any[] = []
      try {
        const now = new Date()
        const [overdueInvoices, overdueBills, lowStock, uncategorized, openDeals] = await Promise.all([
          db.invoice.count({ where: { businessId: business.id, status: { in: ['open', 'partial'] }, dueDate: { lt: now } } }).catch(() => 0),
          db.bill.count({ where: { businessId: business.id, status: { in: ['open', 'partial'] }, dueDate: { lt: now } } }).catch(() => 0),
          db.product.count({ where: { businessId: business.id, inventoryQty: { lte: 5, gt: 0 } } }).catch(() => 0),
          db.transaction.count({ where: { businessId: business.id, category: null } }).catch(() => 0),
          db.deal.count({ where: { businessId: business.id, status: 'open' } }).catch(() => 0),
        ])
        if (overdueInvoices > 0) signals.push({ title: overdueInvoices + ' overdue invoice(s) need attention', severity: 'warning', urgencyWindow: 'Today', module: 'invoices' })
        if (overdueBills > 0) signals.push({ title: overdueBills + ' bill(s) past due', severity: 'critical', urgencyWindow: 'Today', module: 'invoices' })
        if (lowStock > 0) signals.push({ title: lowStock + ' product(s) running low on stock', severity: 'warning', urgencyWindow: 'This week', module: 'inventory' })
        if (uncategorized > 10) signals.push({ title: uncategorized + ' transactions need categorization', severity: 'info', urgencyWindow: 'This week', module: 'autobooks' })
        if (openDeals > 0) signals.push({ title: openDeals + ' deal(s) in pipeline need follow-up', severity: 'info', urgencyWindow: 'This week', module: 'crm' })
      } catch (e) { console.error('Intelligence scan error:', e) }
      return NextResponse.json({ signals, count: signals.length })
    }
    return NextResponse.json({ summary: 'Business operating normally.', signals: [], generatedAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Intelligence API error:', err)
    return NextResponse.json({ signals: [], count: 0 })
  }
}
