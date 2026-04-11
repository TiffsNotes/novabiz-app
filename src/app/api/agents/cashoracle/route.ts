import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []
      const now = new Date()

      // Get 30-day average daily income/expenses
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const [income, expenses] = await Promise.all([
        db.transaction.aggregate({
          where: { businessId: business.id, amount: { gt: 0 }, date: { gte: thirtyDaysAgo } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),
        db.transaction.aggregate({
          where: { businessId: business.id, amount: { lt: 0 }, date: { gte: thirtyDaysAgo } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),
      ])

      const avgDailyIncome = Math.abs(Number(income._sum.amount) || 0) / 30
      const avgDailyExpenses = Math.abs(Number(expenses._sum.amount) || 0) / 30
      const avgDailyNet = avgDailyIncome - avgDailyExpenses

      // Get bank account balances
      const accounts = await db.bankAccount.findMany({
        where: { businessId: business.id },
      }).catch(() => [])

      const currentCash = accounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0)

      // Cash runway alert
      if (avgDailyNet < 0 && currentCash > 0) {
        const runwayDays = Math.floor(currentCash / Math.abs(avgDailyNet))
        if (runwayDays < 90) {
          const _existing = await db.agentAlert.findFirst({ where: { businessId: business.id, type: "dedup", dismissed: false } }).catch(() => null); await db.agentAlert.create({
            data: {
              businessId: business.id,
              type: 'cash_runway',
              title: 'Cash runway alert: ' + runwayDays + ' days remaining',
              description: 'At current burn rate of $' + (Math.abs(avgDailyNet) / 100).toFixed(0) + '/day, cash will be depleted in ' + runwayDays + ' days.',
              severity: runwayDays < 30 ? 'critical' : 'warning',
              module: 'forecast',
              actionRequired: true,
              data: { runwayDays, currentCash, avgDailyNet },
            },
          }).catch(() => null)
          actions.push('Cash runway alert: ' + runwayDays + ' days')
        }
      }

      // Overdue invoices
      const overdueInvoices = await db.invoice.findMany({
        where: {
          businessId: business.id,
          status: { in: ['SENT', 'PARTIAL'] },
          dueDate: { lt: now },
        },
        orderBy: { amountDue: 'desc' },
        take: 10,
      }).catch(() => [])

      if (overdueInvoices.length > 0) {
        const totalOverdue = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.amountDue || 0), 0)
        const _existing = await db.agentAlert.findFirst({ where: { businessId: business.id, type: "dedup", dismissed: false } }).catch(() => null); await db.agentAlert.create({
          data: {
            businessId: business.id,
            type: 'collections',
            title: overdueInvoices.length + ' overdue invoices — $' + (totalOverdue / 100).toFixed(0) + ' uncollected',
            description: 'Oldest overdue invoice: ' + (overdueInvoices[0] as any).number + ' — $' + ((overdueInvoices[0] as any).amountDue / 100).toFixed(0),
            severity: 'warning',
            module: 'invoices',
            actionRequired: true,
            data: { count: overdueInvoices.length, totalOverdue },
          },
        }).catch(() => null)
        actions.push('Flagged ' + overdueInvoices.length + ' overdue invoices')
      }

      // Upcoming bills
      const upcomingBills = await db.bill.findMany({
        where: {
          businessId: business.id,
          status: { in: ['RECEIVED', 'PARTIAL'] },
          dueDate: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }).catch(() => [])

      if (upcomingBills.length > 0) {
        const totalDue = upcomingBills.reduce((sum: number, b: any) => sum + (b.amountDue || 0), 0)
        const _existing = await db.agentAlert.findFirst({ where: { businessId: business.id, type: "dedup", dismissed: false } }).catch(() => null); await db.agentAlert.create({
          data: {
            businessId: business.id,
            type: 'bills_due',
            title: upcomingBills.length + ' bills due this week — $' + (totalDue / 100).toFixed(0),
            description: upcomingBills.map((b: any) => b.number + ' $' + ((b.amountDue || 0) / 100).toFixed(0)).join(', '),
            severity: 'info',
            module: 'invoices',
            actionRequired: false,
            data: { count: upcomingBills.length, totalDue },
          },
        }).catch(() => null)
        actions.push('Flagged ' + upcomingBills.length + ' upcoming bills')
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('CashOracle agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
