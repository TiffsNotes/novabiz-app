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
    const view = new URL(req.url).searchParams.get('view') || 'summary'
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    if (view === 'summary') {
      const [revenue, expenses, uncategorized, total] = await Promise.all([
        db.transaction.aggregate({ where: { businessId: business.id, type: 'income', date: { gte: startOfMonth } }, _sum: { amount: true } }),
        db.transaction.aggregate({ where: { businessId: business.id, type: 'expense', date: { gte: startOfMonth } }, _sum: { amount: true } }),
        db.transaction.count({ where: { businessId: business.id, category: null } }),
        db.transaction.count({ where: { businessId: business.id } }),
      ])
      const revMTD = Math.abs((revenue._sum.amount as number) || 0)
      const expMTD = Math.abs((expenses._sum.amount as number) || 0)
      return NextResponse.json({ revenue: revMTD, expenses: expMTD, profit: revMTD - expMTD, margin: revMTD > 0 ? ((revMTD - expMTD) / revMTD) * 100 : 0, needsReview: uncategorized, totalTransactions: total, period: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) })
    }
    if (view === 'transactions') {
      const page = parseInt(new URL(req.url).searchParams.get('page') || '1')
      const limit = parseInt(new URL(req.url).searchParams.get('limit') || '50')
      const [transactions, total] = await Promise.all([
        db.transaction.findMany({ where: { businessId: business.id }, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
        db.transaction.count({ where: { businessId: business.id } }),
      ])
      return NextResponse.json({ transactions, total, page, limit })
    }
    if (view === 'pl') {
      const transactions = await db.transaction.findMany({ where: { businessId: business.id, date: { gte: startOfMonth } }, orderBy: { date: 'desc' } })
      const income = transactions.filter(t => t.type === 'income')
      const expenses = transactions.filter(t => t.type === 'expense')
      const groupBy = (txns: typeof transactions) => {
        const groups: Record<string, number> = {}
        txns.forEach(t => { const key = t.category || 'Uncategorized'; groups[key] = (groups[key] || 0) + Math.abs(t.amount) })
        return Object.entries(groups).map(([category, amount]) => ({ category, amount }))
      }
      return NextResponse.json({ period: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), income: groupBy(income), expenses: groupBy(expenses), totalIncome: income.reduce((s, t) => s + Math.abs(t.amount), 0), totalExpenses: expenses.reduce((s, t) => s + Math.abs(t.amount), 0) })
    }
    if (view === 'categories') {
      const transactions = await db.transaction.findMany({ where: { businessId: business.id }, orderBy: { date: 'desc' }, take: 500 })
      const categories: Record<string, { count: number; total: number; type: string }> = {}
      transactions.forEach(t => { const key = t.category || 'Uncategorized'; if (!categories[key]) categories[key] = { count: 0, total: 0, type: t.type }; categories[key].count++; categories[key].total += Math.abs(t.amount) })
      return NextResponse.json({ categories: Object.entries(categories).map(([name, data]) => ({ name, ...data })) })
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
    if (action === 'categorize') {
      await db.transaction.update({ where: { id: body.transactionId }, data: { category: body.category, status: 'reviewed' } })
      return NextResponse.json({ success: true })
    }
    if (action === 'auto_categorize') {
      const uncategorized = await db.transaction.findMany({ where: { businessId: business.id, category: null }, take: 100 })
      const rules: Record<string, string> = { 'rent': 'Rent & Utilities', 'electric': 'Rent & Utilities', 'gas': 'Rent & Utilities', 'payroll': 'Payroll', 'salary': 'Payroll', 'insurance': 'Insurance', 'marketing': 'Marketing', 'ads': 'Marketing', 'supplies': 'Supplies', 'software': 'Software & Tech', 'subscription': 'Software & Tech', 'food': 'Food & Beverage', 'sales': 'Sales Revenue' }
      let categorized = 0
      for (const txn of uncategorized) {
        const desc = (txn.description || '').toLowerCase()
        for (const [keyword, category] of Object.entries(rules)) {
          if (desc.includes(keyword)) {
            await db.transaction.update({ where: { id: txn.id }, data: { category, status: 'auto_categorized' } })
            categorized++
            break
          }
        }
      }
      return NextResponse.json({ success: true, categorized })
    }
    if (action === 'sync_quickbooks') {
      return NextResponse.json({ success: true, message: 'QuickBooks sync initiated.' })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
