import { db } from '@/lib/db'
import type { SavingsSummary, Money } from '@/types'
import { startOfMonth, subDays, subMonths } from 'date-fns'

// ─── RECORD A SAVING ─────────────────────────────────────────

export async function recordSaving(params: {
  businessId: string
  module: string
  category: string
  amount: Money // cents
  description: string
  evidence?: string
  recurring?: boolean
  vendorName?: string
}) {
  return db.savingsEntry.create({
    data: {
      businessId: params.businessId,
      module: params.module as any,
      category: params.category,
      amount: params.amount,
      description: params.description,
      evidence: params.evidence,
      recurring: params.recurring || false,
      vendorName: params.vendorName,
    },
  })
}

// ─── GET SAVINGS SUMMARY ─────────────────────────────────────

export async function getSavingsSummary(businessId: string): Promise<SavingsSummary> {
  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)
  const mtdStart = startOfMonth(now)

  // Get all savings entries
  const [allEntries, mtdEntries, last30Entries] = await Promise.all([
    db.savingsEntry.findMany({ where: { businessId } }),
    db.savingsEntry.findMany({ where: { businessId, date: { gte: mtdStart } } }),
    db.savingsEntry.findMany({ where: { businessId, date: { gte: thirtyDaysAgo } } }),
  ])

  const totalSavedAllTime = allEntries.reduce((sum, e) => sum + e.amount, 0)
  const totalSavedMtd = mtdEntries.reduce((sum, e) => sum + e.amount, 0)
  const totalSaved30Days = last30Entries.reduce((sum, e) => sum + e.amount, 0)

  // Breakdown by module
  const moduleMap = new Map<string, number>()
  for (const entry of last30Entries) {
    moduleMap.set(entry.module, (moduleMap.get(entry.module) || 0) + entry.amount)
  }

  const breakdown = Array.from(moduleMap.entries()).map(([module, amount]) => ({
    module: module as any,
    amount,
    label: MODULE_LABELS[module] || module,
  }))

  // ROI calculation (assumes $499/mo Pro plan)
  const novaBizCost = 49900 // $499 in cents
  const roi = totalSaved30Days > 0 ? totalSaved30Days / novaBizCost : 0

  // Vendors cancelled (from recurring savings entries)
  const vendorsCancelled = [
    ...new Set(
      allEntries
        .filter((e) => e.recurring && e.vendorName)
        .map((e) => e.vendorName!)
    ),
  ]

  // Trend (last 30 days, grouped by day)
  const trendMap = new Map<string, number>()
  for (const entry of last30Entries) {
    const day = entry.date.toISOString().split('T')[0]
    trendMap.set(day, (trendMap.get(day) || 0) + entry.amount)
  }

  // Fill in missing days with 0
  const trend = []
  for (let i = 29; i >= 0; i--) {
    const date = subDays(now, i).toISOString().split('T')[0]
    trend.push({ date, amount: trendMap.get(date) || 0 })
  }

  return {
    totalSavedMtd,
    totalSaved30Days,
    totalSavedAllTime,
    breakdown,
    comparison: {
      oldCost: 420000, // $4,200 average
      newCost: novaBizCost,
      netSaving: totalSaved30Days,
      roi: Math.round(roi * 10) / 10,
    },
    vendorsCancelled,
    trend,
  }
}

// ─── SEED INITIAL SAVINGS FOR DEMO ───────────────────────────
// Called during onboarding to populate the savings dashboard with
// estimated savings based on current spending analysis

export async function seedEstimatedSavings(businessId: string) {
  // Analyze current vendor spending
  const vendors = await db.vendor.findMany({
    where: { businessId, isRecurring: true },
    orderBy: { avgMonthlySpend: 'desc' },
    take: 10,
  })

  const savings = []

  // AutoBooks saves bookkeeper cost
  const bookkeeper = await detectBookkeeperSpend(businessId)
  if (bookkeeper > 0) {
    savings.push({
      module: 'AUTOBOOKS' as const,
      category: 'vendor_cancelled',
      amount: bookkeeper,
      description: 'Bookkeeping service replaced by AutoBooks',
      recurring: true,
      vendorName: 'Bookkeeper',
    })
  }

  // Log savings
  for (const saving of savings) {
    await recordSaving({ businessId, ...saving })
  }

  return savings.length
}

async function detectBookkeeperSpend(businessId: string): Promise<number> {
  const bookkeepingKeywords = ['bookkeep', 'accounting', 'quickbooks', 'bench ', 'botkeeper']

  const transactions = await db.transaction.findMany({
    where: { businessId, amount: { lt: 0 } },
    orderBy: { date: 'desc' },
    take: 500,
  })

  const bookkeepingTx = transactions.filter((tx) =>
    bookkeepingKeywords.some((kw) =>
      tx.description.toLowerCase().includes(kw)
    )
  )

  if (bookkeepingTx.length === 0) return 80000 // Default $800 estimate

  const avgMonthly = Math.abs(bookkeepingTx.reduce((sum, tx) => sum + tx.amount, 0)) / 3
  return Math.round(avgMonthly)
}

const MODULE_LABELS: Record<string, string> = {
  AUTOBOOKS: 'AutoBooks',
  PAYROLL: 'PayrollAI',
  GROWTH: 'GrowthEngine',
  SALES: 'SalesFlow',
  SUPPLY_CHAIN: 'SupplyChainAI',
  CASH_ORACLE: 'CashOracle',
  COMPLIANCE: 'ComplianceGuard',
  OPS_SCHEDULER: 'OpsScheduler',
}
