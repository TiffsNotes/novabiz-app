import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { startOfMonth, subMonths, subDays, format } from 'date-fns'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── EXECUTIVE DASHBOARD KPIs ────────────────────────────────

export async function getExecutiveDashboard(businessId: string) {
  const now = new Date()
  const mtdStart = startOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = new Date(mtdStart.getTime() - 1)

  const [
    financials,
    salesMetrics,
    inventoryHealth,
    hrMetrics,
    projectMetrics,
    ecomMetrics,
    cashPosition,
    inboxCount,
    savingsMtd,
  ] = await Promise.all([
    getFinancialKPIs(businessId, mtdStart, prevMonthStart, prevMonthEnd),
    getSalesKPIs(businessId, mtdStart, prevMonthStart),
    getInventoryKPIs(businessId),
    getHRKPIs(businessId),
    getProjectKPIs(businessId),
    getEcomKPIs(businessId, mtdStart),
    getCashPosition(businessId),
    db.inboxItem.count({ where: { businessId, resolvedAt: null, dismissed: false } }),
    db.savingsEntry.aggregate({
      where: { businessId, date: { gte: mtdStart } },
      _sum: { amount: true },
    }),
  ])

  return {
    period: format(now, 'MMMM yyyy'),
    financials,
    sales: salesMetrics,
    inventory: inventoryHealth,
    hr: hrMetrics,
    projects: projectMetrics,
    ecommerce: ecomMetrics,
    cash: cashPosition,
    inbox: { pending: inboxCount },
    savings: { mtd: savingsMtd._sum.amount || 0 },
    generatedAt: now,
  }
}

async function getFinancialKPIs(businessId: string, mtdStart: Date, prevStart: Date, prevEnd: Date) {
  const [mtdIncome, mtdExpense, prevIncome, prevExpense, arBalance, apBalance] = await Promise.all([
    db.transaction.aggregate({
      where: { businessId, amount: { gt: 0 }, date: { gte: mtdStart }, excluded: false },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { businessId, amount: { lt: 0 }, date: { gte: mtdStart }, excluded: false },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { businessId, amount: { gt: 0 }, date: { gte: prevStart, lte: prevEnd }, excluded: false },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { businessId, amount: { lt: 0 }, date: { gte: prevStart, lte: prevEnd }, excluded: false },
      _sum: { amount: true },
    }),
    db.invoice.aggregate({
      where: { businessId, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
      _sum: { amountDue: true },
    }),
    db.bill.aggregate({
      where: { businessId, status: { in: ['draft', 'approved'] }, paidAt: null },
      _sum: { total: true },
    }),
  ])

  const revenue = mtdIncome._sum.amount || 0
  const expenses = Math.abs(mtdExpense._sum.amount || 0)
  const prevRevenue = prevIncome._sum.amount || 0
  const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0

  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
    revenueGrowth,
    arBalance: arBalance._sum.amountDue || 0,
    apBalance: apBalance._sum.total || 0,
  }
}

async function getSalesKPIs(businessId: string, mtdStart: Date, prevStart: Date) {
  const [wonDeals, pipelineDeals, newContacts] = await Promise.all([
    db.deal.findMany({
      where: { businessId, wonLost: 'won', closedAt: { gte: mtdStart } },
      select: { value: true },
    }),
    db.deal.findMany({
      where: { businessId, wonLost: null },
      select: { value: true, probability: true },
    }),
    db.contact.count({ where: { businessId, createdAt: { gte: mtdStart } } }),
  ])

  const wonRevenue = wonDeals.reduce((s, d) => s + (d.value || 0), 0)
  const pipelineValue = pipelineDeals.reduce((s, d) => s + (d.value || 0), 0)
  const weightedPipeline = pipelineDeals.reduce((s, d) => s + (d.value || 0) * (d.probability / 100), 0)

  return {
    wonDeals: wonDeals.length,
    wonRevenue,
    pipelineDeals: pipelineDeals.length,
    pipelineValue,
    weightedPipeline: Math.round(weightedPipeline),
    newContacts,
    avgDealSize: wonDeals.length ? Math.round(wonRevenue / wonDeals.length) : 0,
  }
}

async function getInventoryKPIs(businessId: string) {
  const items = await db.$queryRaw<Array<{
    lowStock: bigint; outOfStock: bigint; totalValue: bigint; totalSkus: bigint
  }>>`
    SELECT
      COUNT(CASE WHEN available <= "reorderPoint" AND available > 0 THEN 1 END) as "lowStock",
      COUNT(CASE WHEN "onHand" = 0 THEN 1 END) as "outOfStock",
      COALESCE(SUM("onHand" * p."unitCost"), 0) as "totalValue",
      COUNT(*) as "totalSkus"
    FROM inventory_items i
    JOIN products p ON p.id = i."productId"
    WHERE i."businessId" = ${businessId}
  `

  return {
    lowStock: Number(items[0]?.lowStock || 0),
    outOfStock: Number(items[0]?.outOfStock || 0),
    totalValue: Number(items[0]?.totalValue || 0),
    totalSkus: Number(items[0]?.totalSkus || 0),
  }
}

async function getHRKPIs(businessId: string) {
  const [activeCount, pendingLeave, pendingExpenses, payrollThisMonth] = await Promise.all([
    db.employee.count({ where: { businessId, status: 'active' } }),
    db.leaveRequest.count({ where: { businessId, status: 'pending' } }),
    db.expense.count({ where: { businessId, status: 'pending' } }),
    db.payrollRun.aggregate({
      where: {
        businessId,
        payDate: { gte: startOfMonth(new Date()) },
        status: { in: ['completed', 'processing'] },
      },
      _sum: { totalGross: true },
    }),
  ])

  return {
    headcount: activeCount,
    pendingLeave,
    pendingExpenses,
    payrollThisMonth: payrollThisMonth._sum.totalGross || 0,
  }
}

async function getProjectKPIs(businessId: string) {
  const [active, overBudget, billableHours] = await Promise.all([
    db.project.count({ where: { businessId, status: 'active' } }),
    db.project.count({
      where: { businessId, status: 'active', budget: { not: null } },
    }),
    db.timesheet.aggregate({
      where: {
        businessId,
        billable: true,
        date: { gte: startOfMonth(new Date()) },
        status: 'approved',
      },
      _sum: { hours: true },
    }),
  ])

  const overBudgetReal = await db.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM projects
    WHERE "businessId" = ${businessId}
    AND status = 'active'
    AND budget IS NOT NULL
    AND "actualCost" > budget
  `

  return {
    activeProjects: active,
    overBudgetProjects: Number(overBudgetReal[0]?.count || 0),
    billableHoursMtd: billableHours._sum.hours || 0,
  }
}

async function getEcomKPIs(businessId: string, mtdStart: Date) {
  const [orders, revenue, newCustomers] = await Promise.all([
    db.ecomOrder.count({ where: { businessId, createdAt: { gte: mtdStart } } }),
    db.ecomOrder.aggregate({
      where: { businessId, createdAt: { gte: mtdStart }, status: { notIn: ['cancelled'] } },
      _sum: { total: true },
    }),
    db.customer.count({ where: { businessId, createdAt: { gte: mtdStart } } }),
  ])

  return {
    ordersMtd: orders,
    revenueMtd: revenue._sum.total || 0,
    newCustomers,
    aov: orders > 0 ? Math.round((revenue._sum.total || 0) / orders) : 0,
  }
}

async function getCashPosition(businessId: string) {
  const accounts = await db.bankAccount.findMany({
    where: { businessId },
    select: { currentBalance: true, availableBalance: true, type: true, name: true },
  })

  const checking = accounts.filter(a => a.type === 'depository')
  const total = checking.reduce((s, a) => s + (a.currentBalance || 0), 0)

  // Get 30-day forecast
  const forecast30 = await db.cashForecast.findFirst({
    where: {
      businessId,
      forecastDate: {
        gte: new Date(Date.now() + 29 * 86400000),
        lte: new Date(Date.now() + 31 * 86400000),
      },
    },
    orderBy: { generatedAt: 'desc' },
  })

  return {
    current: total,
    forecast30: forecast30?.projectedBalance,
    accounts: accounts.map(a => ({ name: a.name, balance: a.currentBalance || 0, type: a.type })),
  }
}

// ─── AI BUSINESS BRIEF ──────────────────────────────────────

export async function generateDailyBrief(businessId: string): Promise<string> {
  const dashboard = await getExecutiveDashboard(businessId)
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } })

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: `You are NOVA CoS, the AI Chief of Staff for ${business.name}. 
Write a concise executive brief (4-6 bullet points) highlighting the most important items for today.
Focus on: financial performance vs prior month, pipeline status, operational risks, and recommended actions.
Be specific with numbers. Format as bullet points starting with an emoji.`,
    messages: [{
      role: 'user',
      content: `Here is today's business snapshot:\n${JSON.stringify(dashboard, null, 2)}\n\nGenerate the daily executive brief.`,
    }],
  })

  return (res.content[0] as { type: string; text: string }).text
}

// ─── CUSTOM REPORT BUILDER ───────────────────────────────────

export async function buildReport(businessId: string, config: {
  type: 'pl' | 'balance_sheet' | 'cash_flow' | 'ar_aging' | 'inventory' | 'payroll_summary'
  period: string
  currency?: string
}) {
  const [year, month] = config.period.split('-').map(Number)
  const startDate = new Date(year, (month || 1) - 1, 1)
  const endDate = month ? new Date(year, month, 0) : new Date(year, 11, 31)

  let data: Record<string, unknown>

  switch (config.type) {
    case 'pl':
      data = await buildPLReport(businessId, startDate, endDate)
      break
    case 'ar_aging':
      data = await buildARAgingReport(businessId)
      break
    case 'inventory':
      data = await buildInventoryReport(businessId)
      break
    case 'payroll_summary':
      data = await buildPayrollReport(businessId, startDate, endDate)
      break
    default:
      data = {}
  }

  const report = await db.report.create({
    data: {
      businessId,
      type: config.type,
      period: config.period,
      data,
      generatedAt: new Date(),
    },
  })

  return report
}

async function buildPLReport(businessId: string, start: Date, end: Date) {
  const transactions = await db.transaction.findMany({
    where: { businessId, date: { gte: start, lte: end }, excluded: false },
    include: { category: true },
  })

  const income = transactions.filter(t => t.category?.type === 'INCOME')
  const expenses = transactions.filter(t => t.category?.type === 'EXPENSE')

  const groupBy = (txs: typeof transactions) => {
    const map = new Map<string, number>()
    for (const tx of txs) {
      const key = tx.category?.name || 'Uncategorized'
      map.set(key, (map.get(key) || 0) + Math.abs(tx.amount))
    }
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
  }

  const totalRevenue = income.reduce((s, t) => s + t.amount, 0)
  const totalExpenses = Math.abs(expenses.reduce((s, t) => s + t.amount, 0))

  return {
    period: `${start.toISOString().split('T')[0]} – ${end.toISOString().split('T')[0]}`,
    revenue: { total: totalRevenue, byCategory: groupBy(income) },
    expenses: { total: totalExpenses, byCategory: groupBy(expenses) },
    grossProfit: totalRevenue - totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    netMargin: totalRevenue > 0 ? (totalRevenue - totalExpenses) / totalRevenue : 0,
  }
}

async function buildARAgingReport(businessId: string) {
  const invoices = await db.invoice.findMany({
    where: { businessId, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
    include: { contact: true, company: true },
  })

  const now = new Date()
  const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0 }
  const details = []

  for (const inv of invoices) {
    const daysOverdue = inv.dueDate ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000) : 0
    const amount = inv.amountDue

    if (daysOverdue <= 0) buckets.current += amount
    else if (daysOverdue <= 30) buckets.days1_30 += amount
    else if (daysOverdue <= 60) buckets.days31_60 += amount
    else if (daysOverdue <= 90) buckets.days61_90 += amount
    else buckets.over90 += amount

    details.push({
      invoiceNumber: inv.number,
      client: inv.company?.name || `${inv.contact?.firstName} ${inv.contact?.lastName}`,
      amount: inv.amountDue,
      dueDate: inv.dueDate,
      daysOverdue: Math.max(0, daysOverdue),
    })
  }

  return {
    buckets,
    total: Object.values(buckets).reduce((a, b) => a + b, 0),
    details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
  }
}

async function buildInventoryReport(businessId: string) {
  const items = await db.inventoryItem.findMany({
    where: { businessId },
    include: { product: true, warehouse: true },
  })

  return {
    items: items.map(i => ({
      sku: i.product.sku,
      name: i.product.name,
      warehouse: i.warehouse.name,
      onHand: i.onHand,
      available: i.available,
      reserved: i.reserved,
      reorderPoint: i.reorderPoint,
      value: i.onHand * (i.product.unitCost),
      status: i.onHand === 0 ? 'out_of_stock' : i.available <= i.reorderPoint ? 'low_stock' : 'ok',
    })),
    totalValue: items.reduce((s, i) => s + i.onHand * i.product.unitCost, 0),
    totalSkus: items.length,
    lowStock: items.filter(i => i.available <= i.reorderPoint && i.onHand > 0).length,
    outOfStock: items.filter(i => i.onHand === 0).length,
  }
}

async function buildPayrollReport(businessId: string, start: Date, end: Date) {
  const runs = await db.payrollRun.findMany({
    where: { businessId, payDate: { gte: start, lte: end }, status: { in: ['completed', 'processing'] } },
    include: { employees: { include: { employee: { select: { firstName: true, lastName: true, department: true, type: true } } } } },
  })

  return {
    runCount: runs.length,
    totalGross: runs.reduce((s, r) => s + r.totalGross, 0),
    totalNet: runs.reduce((s, r) => s + r.totalNet, 0),
    totalTaxes: runs.reduce((s, r) => s + r.totalTaxes, 0),
    runs: runs.map(r => ({
      period: `${r.payPeriodStart.toISOString().split('T')[0]} – ${r.payPeriodEnd.toISOString().split('T')[0]}`,
      payDate: r.payDate,
      gross: r.totalGross,
      net: r.totalNet,
      employees: r.employees.length,
    })),
  }
}
