import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []
      const now = new Date()

      // Get current cash position
      const accounts = await db.bankAccount.findMany({
        where: { businessId: business.id },
      }).catch(() => [])

      const currentCash = accounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0)

      // Get 30-day average daily burn
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const [income, expenses] = await Promise.all([
        db.transaction.aggregate({
          where: { businessId: business.id, type: 'income', date: { gte: thirtyDaysAgo } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),
        db.transaction.aggregate({
          where: { businessId: business.id, type: 'expense', date: { gte: thirtyDaysAgo } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),
      ])

      const avgDailyIncome = Math.abs((income._sum.amount as number) || 0) / 30
      const avgDailyExpenses = Math.abs((expenses._sum.amount as number) || 0) / 30
      const avgDailyNet = avgDailyIncome - avgDailyExpenses

      // Check cash runway
      if (avgDailyNet < 0 && currentCash > 0) {
        const runwayDays = Math.floor(currentCash / Math.abs(avgDailyNet))
        if (runwayDays < 90) {
          await db.inboxItem.create({
            data: {
              businessId: business.id,
              type: 'cash_runway',
              title: 'Cash runway alert: ' + runwayDays + ' days remaining',
              description: 'At current burn rate of $' + (Math.abs(avgDailyNet) / 100).toFixed(0) + '/day, cash reserves will be depleted in ' + runwayDays + ' days. Current balance: $' + (currentCash / 100).toFixed(0),
              severity: runwayDays < 30 ? 'critical' : 'warning',
              module: 'forecast',
              actionRequired: true,
              data: { runwayDays, currentCash, avgDailyBurn: avgDailyNet },
            },
          }).catch(() => null)
          actions.push('Cash runway alert: ' + runwayDays + ' days')
        }
      }

      // Check for overdue invoices and flag for collection
      const overdueInvoices = await db.invoice.findMany({
        where: {
          businessId: business.id,
          status: { in: ['open', 'partial'] },
          dueDate: { lt: now },
        },
        orderBy: { balance: 'desc' },
        take: 10,
      })

      if (overdueInvoices.length > 0) {
        const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0)
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'collections',
            title: overdueInvoices.length + ' overdue invoices — $' + (totalOverdue / 100).toFixed(0) + ' uncollected',
            description: 'Oldest: ' + overdueInvoices[0].customerName + ' — $' + ((overdueInvoices[0].balance || 0) / 100).toFixed(0) + ' overdue since ' + overdueInvoices[0].dueDate?.toLocaleDateString(),
            severity: 'warning',
            module: 'invoices',
            actionRequired: true,
            data: { count: overdueInvoices.length, totalOverdue },
          },
        }).catch(() => null)
        actions.push('Flagged ' + overdueInvoices.length + ' overdue invoices')
      }

      // Check for upcoming bills due in 7 days
      const upcomingBills = await db.bill.findMany({
        where: {
          businessId: business.id,
          status: { in: ['open', 'partial'] },
          dueDate: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      })

      if (upcomingBills.length > 0) {
        const totalDue = upcomingBills.reduce((sum, b) => sum + (b.balance || 0), 0)
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'bills_due',
            title: upcomingBills.length + ' bills due this week — $' + (totalDue / 100).toFixed(0),
            description: upcomingBills.map(b => b.vendorName + ' $' + ((b.balance || 0) / 100).toFixed(0)).join(', '),
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
