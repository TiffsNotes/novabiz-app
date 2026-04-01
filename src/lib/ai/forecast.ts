import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { addDays, format, startOfDay } from 'date-fns'
import type { CashForecastSummary, ForecastPoint, Money } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── GENERATE 90-DAY FORECAST ────────────────────────────────

export async function generateForecast(businessId: string): Promise<CashForecastSummary> {
  // 1. Get current balances
  const accounts = await db.bankAccount.findMany({
    where: { businessId },
    select: { currentBalance: true, availableBalance: true, type: true },
  })

  const currentBalance = accounts
    .filter((a) => a.type !== 'credit')
    .reduce((sum, a) => sum + (a.currentBalance || 0), 0)

  // 2. Get 90 days of transaction history for pattern analysis
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const transactions = await db.transaction.findMany({
    where: {
      businessId,
      date: { gte: ninetyDaysAgo },
      pending: false,
      excluded: false,
    },
    include: { category: true, vendor: true },
    orderBy: { date: 'asc' },
  })

  // 3. Analyze patterns with Claude
  const patterns = await analyzeSpendingPatterns(transactions, currentBalance)

  // 4. Generate day-by-day forecast
  const forecastPoints = generateDailyForecast(currentBalance, patterns)

  // 5. Store forecast in DB
  await storeForecast(businessId, forecastPoints)

  // 6. Calculate summary metrics
  const balance30 = forecastPoints[29]?.balance || currentBalance
  const balance90 = forecastPoints[89]?.balance || currentBalance

  // Find runway (days until balance goes below 0)
  const runwayPoint = forecastPoints.find((p) => p.balance < 0)
  const runwayDays = runwayPoint
    ? forecastPoints.indexOf(runwayPoint)
    : null

  // Alert level
  let alertLevel: 'ok' | 'warning' | 'critical' = 'ok'
  if (balance30 < 0) alertLevel = 'critical'
  else if (balance30 < currentBalance * 0.2) alertLevel = 'warning'

  // Find next large outflow
  const largeOutflows = forecastPoints
    .filter((p, i) => i > 0 && p.outflows > 200000) // > $2,000
    .sort((a, b) => b.outflows - a.outflows)
  const nextLargeOutflow = largeOutflows[0]
    ? {
        date: nextLargeOutflow ? largeOutflows[0].date : '',
        amount: largeOutflows[0].outflows,
        description: 'Estimated based on historical patterns',
      }
    : undefined

  // Quarterly tax estimate (25% of projected net income)
  const projectedNet = forecastPoints
    .slice(0, 90)
    .reduce((sum, p) => sum + p.inflows - p.outflows, 0)
  const taxSetAside = Math.max(0, Math.round(projectedNet * 0.25))

  return {
    currentBalance,
    balanceIn30Days: balance30,
    balanceIn90Days: balance90,
    runwayDays,
    alertLevel,
    nextLargeOutflow,
    taxSetAside,
    points: forecastPoints,
  }
}

// ─── PATTERN ANALYSIS ────────────────────────────────────────

async function analyzeSpendingPatterns(
  transactions: Array<{
    date: Date
    amount: number
    description: string
    vendor: { name: string; isRecurring: boolean } | null
    category: { name: string; type: string } | null
  }>,
  currentBalance: number
): Promise<SpendingPatterns> {
  // Calculate monthly averages
  const income = transactions.filter((t) => t.amount > 0)
  const expenses = transactions.filter((t) => t.amount < 0)

  const avgMonthlyIncome = income.reduce((s, t) => s + t.amount, 0) / 3
  const avgMonthlyExpenses = Math.abs(expenses.reduce((s, t) => s + t.amount, 0)) / 3

  // Identify recurring expenses
  const recurringVendors = [
    ...new Set(
      transactions
        .filter((t) => t.vendor?.isRecurring)
        .map((t) => t.vendor!.name)
    ),
  ]

  // Get vendor amounts for recurring
  const recurringMap = new Map<string, number>()
  for (const tx of transactions.filter((t) => t.vendor?.isRecurring)) {
    const key = tx.vendor!.name
    recurringMap.set(key, (recurringMap.get(key) || 0) + Math.abs(tx.amount))
  }

  return {
    avgMonthlyIncome,
    avgMonthlyExpenses,
    avgDailyIncome: avgMonthlyIncome / 30,
    avgDailyExpenses: avgMonthlyExpenses / 30,
    recurringVendors: Array.from(recurringMap.entries()).map(([name, total]) => ({
      name,
      monthlyAmount: Math.round(total / 3),
    })),
    incomeVolatility: 0.15, // TODO: calculate from variance
    seasonality: null,
  }
}

function generateDailyForecast(
  currentBalance: Money,
  patterns: SpendingPatterns
): ForecastPoint[] {
  const points: ForecastPoint[] = []
  let balance = currentBalance

  for (let day = 0; day < 90; day++) {
    const date = format(addDays(new Date(), day + 1), 'yyyy-MM-dd')

    // Estimate daily cash flows
    const inflows = patterns.avgDailyIncome
    const outflows = patterns.avgDailyExpenses

    // Add variance
    const volatilityFactor = 1 + (Math.random() - 0.5) * patterns.incomeVolatility * 0.5
    const dailyInflows = Math.round(inflows * volatilityFactor)
    const dailyOutflows = Math.round(outflows * (1 + (Math.random() - 0.5) * 0.1))

    balance = balance + dailyInflows - dailyOutflows

    // Confidence intervals widen over time
    const confidenceSpread = Math.round(balance * 0.05 * (1 + day / 90))

    points.push({
      date,
      balance,
      inflows: dailyInflows,
      outflows: dailyOutflows,
      confidenceLow: balance - confidenceSpread,
      confidenceHigh: balance + confidenceSpread,
    })
  }

  return points
}

async function storeForecast(
  businessId: string,
  points: ForecastPoint[]
): Promise<void> {
  // Delete old forecasts for this business
  await db.cashForecast.deleteMany({
    where: {
      businessId,
      generatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })

  // Store new forecasts
  await db.cashForecast.createMany({
    data: points.map((p) => ({
      businessId,
      forecastDate: new Date(p.date),
      projectedBalance: p.balance,
      projectedInflows: p.inflows,
      projectedOutflows: p.outflows,
      confidenceLow: p.confidenceLow,
      confidenceHigh: p.confidenceHigh,
    })),
    skipDuplicates: true,
  })
}

interface SpendingPatterns {
  avgMonthlyIncome: number
  avgMonthlyExpenses: number
  avgDailyIncome: number
  avgDailyExpenses: number
  recurringVendors: { name: string; monthlyAmount: number }[]
  incomeVolatility: number
  seasonality: null
}
