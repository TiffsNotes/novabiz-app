import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { AutoBooksAgent } from '@/lib/ai/autobooks'

// GET /api/autobooks?view=transactions|pl|run
export async function GET(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') || 'transactions'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  if (view === 'transactions') {
    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where: {
          businessId: business.id,
          pending: false,
          excluded: false,
        },
        include: { category: true, vendor: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.transaction.count({
        where: { businessId: business.id, pending: false, excluded: false },
      }),
    ])

    return NextResponse.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
        merchantName: tx.merchantName,
        category: tx.category?.name,
        categoryType: tx.category?.type,
        confidence: tx.categoryConfidence,
        reviewed: tx.reviewed,
        pending: tx.pending,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  }

  if (view === 'pl') {
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    const report = await db.report.findFirst({
      where: {
        businessId: business.id,
        type: 'pl',
        period: `${year}-${String(month).padStart(2, '0')}`,
      },
    })

    if (!report) {
      // Generate on-demand
      const agent = new AutoBooksAgent(business.id)
      await agent.generateMonthlyReport(month, year)
      const freshReport = await db.report.findFirst({
        where: { businessId: business.id, type: 'pl' },
        orderBy: { generatedAt: 'desc' },
      })
      return NextResponse.json({ report: freshReport?.data })
    }

    return NextResponse.json({ report: report.data })
  }

  if (view === 'summary') {
    const uncategorized = await db.transaction.count({
      where: { businessId: business.id, categoryId: null, pending: false },
    })

    const [income, expenses] = await Promise.all([
      db.transaction.aggregate({
        where: {
          businessId: business.id,
          amount: { gt: 0 },
          date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: {
          businessId: business.id,
          amount: { lt: 0 },
          date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
    ])

    return NextResponse.json({
      uncategorized,
      mtdRevenue: income._sum.amount || 0,
      mtdExpenses: Math.abs(expenses._sum.amount || 0),
      mtdProfit: (income._sum.amount || 0) + (expenses._sum.amount || 0),
    })
  }

  return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
}

// POST /api/autobooks - trigger AI categorization run
export async function POST(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const agent = new AutoBooksAgent(business.id)
  const result = await agent.run()

  return NextResponse.json({ success: true, ...result })
}
