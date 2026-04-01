// NovaBiz OS — Core Types

export type Money = number // always in cents

export const formatMoney = (cents: Money): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export const formatMoneyDecimal = (cents: Money): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export const parseMoney = (dollars: number): Money => Math.round(dollars * 100)

// ─── BUSINESS ──────────────────────────────────────────────

export interface BusinessThresholds {
  transaction: number        // cents - auto-approve below this
  vendor_new: number         // cents - new vendors need approval
  payroll: number            // 0 = always needs approval
  marketing_spend: number    // cents
}

// ─── TRANSACTIONS ──────────────────────────────────────────

export interface TransactionWithCategory {
  id: string
  date: Date
  amount: Money
  description: string
  merchantName?: string
  categoryName?: string
  categoryType?: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  categoryConfidence?: number
  pending: boolean
  reviewed: boolean
  vendorName?: string
}

export interface CategorizationResult {
  transactionId: string
  categoryName: string
  categoryType: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  confidence: number
  reasoning: string
  suggestedVendor?: string
  isRecurring?: boolean
}

// ─── AI ACTIONS ────────────────────────────────────────────

export type ModuleType =
  | 'AUTOBOOKS'
  | 'PAYROLL'
  | 'GROWTH'
  | 'SALES'
  | 'SUPPLY_CHAIN'
  | 'CASH_ORACLE'
  | 'COMPLIANCE'
  | 'OPS_SCHEDULER'
  | 'COMMAND_INBOX'

export type ActionStatus =
  | 'PENDING'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'

export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
  savingsAmount?: Money  // if this action saved money
}

// ─── INBOX ──────────────────────────────────────────────────

export interface InboxItemWithAction {
  id: string
  title: string
  description?: string
  module: ModuleType
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  amount?: Money
  dueAt?: Date
  createdAt: Date
  action: {
    id: string
    actionType: string
    payload: Record<string, unknown>
    aiReasoning?: string
    confidence?: number
  }
}

// ─── SAVINGS ────────────────────────────────────────────────

export interface SavingsSummary {
  totalSavedMtd: Money        // month to date
  totalSaved30Days: Money
  totalSavedAllTime: Money
  breakdown: {
    module: ModuleType
    amount: Money
    label: string
  }[]
  comparison: {
    oldCost: Money           // what they were paying
    newCost: Money           // NovaBiz cost
    netSaving: Money
    roi: number              // multiplier e.g. 7.4
  }
  vendorsCancelled: string[]
  trend: {
    date: string
    amount: Money
  }[]
}

// ─── FORECASTING ────────────────────────────────────────────

export interface ForecastPoint {
  date: string
  balance: Money
  inflows: Money
  outflows: Money
  confidenceLow: Money
  confidenceHigh: Money
}

export interface CashForecastSummary {
  currentBalance: Money
  balanceIn30Days: Money
  balanceIn90Days: Money
  runwayDays: number | null   // null if no runway concern
  alertLevel: 'ok' | 'warning' | 'critical'
  nextLargeOutflow?: {
    date: string
    amount: Money
    description: string
  }
  taxSetAside: Money          // recommended quarterly tax reserve
  points: ForecastPoint[]
}

// ─── REPORTS ────────────────────────────────────────────────

export interface PLReport {
  period: string
  revenue: {
    total: Money
    byCategory: { name: string; amount: Money }[]
  }
  expenses: {
    total: Money
    byCategory: { name: string; amount: Money }[]
  }
  grossProfit: Money
  netProfit: Money
  netMargin: number
}

// ─── API RESPONSES ──────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ─── PLAID ──────────────────────────────────────────────────

export interface PlaidAccount {
  account_id: string
  name: string
  mask: string
  type: string
  subtype: string
  balances: {
    current: number | null
    available: number | null
  }
}

export interface PlaidTransaction {
  transaction_id: string
  account_id: string
  date: string
  amount: number          // Plaid uses dollars (positive = debit)
  name: string
  merchant_name: string | null
  category: string[]
  pending: boolean
}
