import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []

      // Auto-categorize uncategorized transactions using categoryRaw
      const uncategorized = await db.transaction.findMany({
        where: { businessId: business.id, reviewed: false, categoryId: null },
        take: 200,
      })

      const rules: Record<string, string> = {
        'rent': 'Rent & Utilities', 'lease': 'Rent & Utilities',
        'electric': 'Rent & Utilities', 'gas': 'Rent & Utilities',
        'payroll': 'Payroll', 'salary': 'Payroll', 'wages': 'Payroll', 'gusto': 'Payroll',
        'insurance': 'Insurance',
        'marketing': 'Marketing', 'ads': 'Marketing', 'yelp': 'Marketing', 'google ads': 'Marketing',
        'supplies': 'Supplies', 'depot': 'Cost of Goods',
        'software': 'Software & Tech', 'subscription': 'Software & Tech',
        'sales': 'Sales Revenue', 'square': 'Sales Revenue', 'stripe': 'Sales Revenue', 'pos': 'Sales Revenue',
        'food': 'Cost of Goods', 'beverage': 'Cost of Goods',
        'repair': 'Repairs & Maintenance', 'maintenance': 'Repairs & Maintenance',
        'travel': 'Travel & Entertainment', 'hotel': 'Travel & Entertainment',
        'bank fee': 'Bank Fees', 'service fee': 'Bank Fees',
        'tax': 'Taxes', 'irs': 'Taxes',
      }

      let categorized = 0
      for (const txn of uncategorized) {
        const desc = (txn.description || '').toLowerCase()
        for (const [keyword, category] of Object.entries(rules)) {
          if (desc.includes(keyword)) {
            await db.transaction.update({
              where: { id: txn.id },
              data: {
                categoryRaw: [category],
                categorySource: 'auto',
                reviewed: true,
              },
            })
            categorized++
            break
          }
        }
      }

      if (categorized > 0) {
        actions.push('Auto-categorized ' + categorized + ' transactions')
      }

      // Flag anomalies - transactions significantly larger than average
      const allExpenses = await db.transaction.findMany({
        where: { businessId: business.id, amount: { lt: 0 } },
        select: { amount: true },
      })

      if (allExpenses.length > 5) {
        const avg = allExpenses.reduce((s, t) => s + Math.abs(t.amount), 0) / allExpenses.length

        const anomalies = await db.transaction.findMany({
          where: {
            businessId: business.id,
            amount: { lt: -(avg * 5) },
            date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        })

        for (const anomaly of anomalies) {
          await db.agentAlert.create({
            data: {
              businessId: business.id,
              type: 'anomaly',
              title: 'Unusual expense detected',
              description: (anomaly.description || 'Unknown') + ' — $' + Math.abs(anomaly.amount / 100).toFixed(2) + ' (5x above average of $' + (avg / 100).toFixed(2) + ')',
              severity: 'warning',
              module: 'autobooks',
              actionRequired: true,
              data: { transactionId: anomaly.id, amount: anomaly.amount },
            },
          }).catch(() => null)
          actions.push('Flagged anomaly: ' + (anomaly.description || 'Unknown'))
        }
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('AutoBooks agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
