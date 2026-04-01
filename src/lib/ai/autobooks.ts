import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { createAiAction } from '@/lib/ai/actions'
import type { CategorizationResult } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ─── AUTOBOOKS AGENT ─────────────────────────────────────────

export class AutoBooksAgent {
  private businessId: string

  constructor(businessId: string) {
    this.businessId = businessId
  }

  // Main entry point — runs on schedule or on-demand
  async run(): Promise<{ categorized: number; queued: number; saved: number }> {
    console.log(`[AutoBooks] Running for business ${this.businessId}`)

    const stats = { categorized: 0, queued: 0, saved: 0 }

    // 1. Get uncategorized transactions
    const transactions = await db.transaction.findMany({
      where: {
        businessId: this.businessId,
        categoryId: null,
        pending: false,
        excluded: false,
      },
      orderBy: { date: 'asc' },
      take: 100, // process in batches
    })

    if (transactions.length === 0) {
      console.log(`[AutoBooks] No uncategorized transactions`)
      return stats
    }

    // 2. Get business context
    const context = await this.getBusinessContext()

    // 3. Categorize with Claude in batches of 20
    const BATCH_SIZE = 20
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE)
      const results = await this.categorizeBatch(batch, context)

      // 4. Apply results based on confidence
      for (const result of results) {
        const tx = transactions.find((t) => t.id === result.transactionId)
        if (!tx) continue

        // Find or create the category
        const category = await this.ensureCategory(result)

        if (result.confidence >= 0.9) {
          // High confidence — apply automatically
          await db.transaction.update({
            where: { id: result.transactionId },
            data: {
              categoryId: category.id,
              categoryConfidence: result.confidence,
              categorySource: 'ai',
              categoryReasoning: result.reasoning,
              reviewed: true,
            },
          })

          // Log the AI action
          await createAiAction({
            businessId: this.businessId,
            module: 'AUTOBOOKS',
            actionType: 'categorize_transaction',
            title: `Categorized: ${tx.description}`,
            description: `${result.categoryName} — ${result.reasoning}`,
            payload: { transactionId: tx.id, category: result.categoryName },
            requiresApproval: false,
            confidence: result.confidence,
            aiReasoning: result.reasoning,
            status: 'COMPLETED',
          })

          stats.categorized++
        } else {
          // Low confidence — queue for review
          const action = await createAiAction({
            businessId: this.businessId,
            module: 'AUTOBOOKS',
            actionType: 'categorize_transaction',
            title: `Review needed: ${tx.description}`,
            description: `AI suggests "${result.categoryName}" (${Math.round(result.confidence * 100)}% confident). Please confirm.`,
            payload: {
              transactionId: tx.id,
              suggestedCategory: result.categoryName,
              amount: tx.amount,
            },
            requiresApproval: true,
            approvalReason: `Confidence too low (${Math.round(result.confidence * 100)}%)`,
            confidence: result.confidence,
            aiReasoning: result.reasoning,
            status: 'PENDING_APPROVAL',
            amount: Math.abs(tx.amount),
          })

          // Create inbox item
          await db.inboxItem.create({
            data: {
              businessId: this.businessId,
              actionId: action.id,
              title: `Categorize: ${tx.merchantName || tx.description}`,
              description: `$${(Math.abs(tx.amount) / 100).toFixed(2)} — AI suggests "${result.categoryName}"`,
              module: 'AUTOBOOKS',
              urgency: 'NORMAL',
              amount: Math.abs(tx.amount),
            },
          })

          stats.queued++
        }
      }
    }

    // 5. Check if month end — generate reports
    const now = new Date()
    if (now.getDate() <= 3) {
      // First 3 days of month — generate previous month report
      await this.generateMonthlyReport(now.getMonth(), now.getFullYear())
      stats.saved++
    }

    console.log(`[AutoBooks] Done: ${JSON.stringify(stats)}`)
    return stats
  }

  // ─── CATEGORIZATION ──────────────────────────────────────

  private async categorizeBatch(
    transactions: Array<{ id: string; amount: number; description: string; merchantName: string | null; date: Date; categoryRaw: string[] }>,
    context: BusinessContext
  ): Promise<CategorizationResult[]> {
    const txList = transactions.map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString().split('T')[0],
      amount: (tx.amount / 100).toFixed(2),
      description: tx.description,
      merchant: tx.merchantName || '',
      plaidCategories: tx.categoryRaw,
    }))

    const systemPrompt = `You are AutoBooks, the AI bookkeeper for ${context.businessName}, a ${context.industry} business.

Business context:
- Monthly revenue: ~$${context.avgMonthlyRevenue}
- Common vendors: ${context.topVendors.join(', ')}
- Employee count: ${context.employeeCount}
- Chart of accounts categories: ${context.categories.map((c) => c.name).join(', ')}

Your job is to categorize financial transactions for ${context.businessName}.
Rules:
1. Only use categories from the chart of accounts provided
2. Assign confidence 0.0-1.0 based on how certain you are
3. If amount is positive (money in), it's likely INCOME
4. If amount is negative (money out), it's likely EXPENSE
5. Flag recurring subscriptions
6. Return ONLY valid JSON, no markdown

Output format:
{
  "results": [
    {
      "transactionId": "...",
      "categoryName": "...",
      "categoryType": "INCOME|EXPENSE|TRANSFER",
      "confidence": 0.95,
      "reasoning": "brief explanation",
      "isRecurring": false
    }
  ]
}`

    const userMessage = `Categorize these transactions:\n${JSON.stringify(txList, null, 2)}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const parsed = JSON.parse(content.text)
    return parsed.results as CategorizationResult[]
  }

  // ─── CONTEXT ─────────────────────────────────────────────

  private async getBusinessContext(): Promise<BusinessContext> {
    const [business, categories, recentVendors] = await Promise.all([
      db.business.findUniqueOrThrow({ where: { id: this.businessId } }),
      db.category.findMany({
        where: { businessId: this.businessId },
        select: { name: true, type: true, coaCode: true },
      }),
      db.vendor.findMany({
        where: { businessId: this.businessId },
        orderBy: { avgMonthlySpend: 'desc' },
        take: 20,
        select: { name: true },
      }),
    ])

    // Calculate avg monthly revenue from recent income transactions
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const incomeTotal = await db.transaction.aggregate({
      where: {
        businessId: this.businessId,
        amount: { gt: 0 },
        date: { gte: threeMonthsAgo },
      },
      _sum: { amount: true },
    })

    return {
      businessName: business.name,
      industry: business.industry || 'small business',
      avgMonthlyRevenue: Math.round(((incomeTotal._sum.amount || 0) / 3) / 100),
      categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
      topVendors: recentVendors.map((v) => v.name),
      employeeCount: business.employeeCount || 0,
    }
  }

  // ─── HELPERS ─────────────────────────────────────────────

  private async ensureCategory(result: CategorizationResult) {
    return db.category.upsert({
      where: {
        businessId_name: {
          businessId: this.businessId,
          name: result.categoryName,
        },
      },
      create: {
        businessId: this.businessId,
        name: result.categoryName,
        type: result.categoryType as 'INCOME' | 'EXPENSE' | 'TRANSFER',
      },
      update: {},
    })
  }

  // ─── MONTHLY REPORT ──────────────────────────────────────

  async generateMonthlyReport(month: number, year: number): Promise<void> {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const transactions = await db.transaction.findMany({
      where: {
        businessId: this.businessId,
        date: { gte: startDate, lte: endDate },
        excluded: false,
        categoryId: { not: null },
      },
      include: { category: true },
    })

    const income = transactions.filter((t) => t.category?.type === 'INCOME')
    const expenses = transactions.filter((t) => t.category?.type === 'EXPENSE')

    const totalRevenue = income.reduce((sum, t) => sum + t.amount, 0)
    const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0))

    // Group by category
    const revenueByCategory = groupByCategory(income)
    const expensesByCategory = groupByCategory(expenses)

    const reportData = {
      period: `${year}-${String(month).padStart(2, '0')}`,
      revenue: { total: totalRevenue, byCategory: revenueByCategory },
      expenses: { total: totalExpenses, byCategory: expensesByCategory },
      grossProfit: totalRevenue - totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      netMargin: totalRevenue > 0 ? (totalRevenue - totalExpenses) / totalRevenue : 0,
    }

    await db.report.upsert({
      where: {
        id: `${this.businessId}-pl-${year}-${month}`,
      },
      create: {
        id: `${this.businessId}-pl-${year}-${month}`,
        businessId: this.businessId,
        type: 'pl',
        period: reportData.period,
        data: reportData,
      },
      update: { data: reportData },
    })
  }
}

// ─── HELPERS ─────────────────────────────────────────────────

function groupByCategory(
  transactions: Array<{ amount: number; category: { name: string } | null }>
): Array<{ name: string; amount: number }> {
  const map = new Map<string, number>()
  for (const tx of transactions) {
    const name = tx.category?.name || 'Uncategorized'
    map.set(name, (map.get(name) || 0) + Math.abs(tx.amount))
  }
  return Array.from(map.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
}

// Default chart of accounts for new businesses
const DEFAULT_CATEGORIES = [
  { name: 'Product Sales', type: 'INCOME' as const, coaCode: '4000' },
  { name: 'Service Revenue', type: 'INCOME' as const, coaCode: '4100' },
  { name: 'Cost of Goods Sold', type: 'EXPENSE' as const, coaCode: '5000' },
  { name: 'Payroll & Benefits', type: 'EXPENSE' as const, coaCode: '6000' },
  { name: 'Rent & Utilities', type: 'EXPENSE' as const, coaCode: '6100' },
  { name: 'Marketing & Advertising', type: 'EXPENSE' as const, coaCode: '6200' },
  { name: 'Software & Subscriptions', type: 'EXPENSE' as const, coaCode: '6300' },
  { name: 'Professional Services', type: 'EXPENSE' as const, coaCode: '6400' },
  { name: 'Office & Supplies', type: 'EXPENSE' as const, coaCode: '6500' },
  { name: 'Travel & Meals', type: 'EXPENSE' as const, coaCode: '6600' },
  { name: 'Bank Fees', type: 'EXPENSE' as const, coaCode: '6700' },
  { name: 'Taxes', type: 'EXPENSE' as const, coaCode: '6800' },
  { name: 'Owner Draw', type: 'TRANSFER' as const, coaCode: '3000' },
]

interface BusinessContext {
  businessName: string
  industry: string
  avgMonthlyRevenue: number
  categories: { name: string; type: string }[]
  topVendors: string[]
  employeeCount: number
}
