/**
 * NovaBiz OS — QuickBooks Online Integration
 * OAuth 2.0 + full data sync (accounts, transactions, invoices, customers, vendors)
 */

import { db } from '@/lib/db'

const QB_BASE_URL = 'https://quickbooks.api.intuit.com/v3'
const QB_SANDBOX_URL = 'https://sandbox-quickbooks.api.intuit.com/v3'
const OAUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function getBaseUrl() {
  return process.env.QB_ENV === 'production' ? QB_BASE_URL : QB_SANDBOX_URL
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function getQuickBooksAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID!,
    redirect_uri: process.env.QB_REDIRECT_URI!,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state,
  })
  return `${OAUTH_URL}?${params}`
}

export async function exchangeQuickBooksCode(code: string, realmId: string) {
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.QB_REDIRECT_URI!,
    }),
  })

  if (!res.ok) throw new Error(`QB token exchange failed: ${await res.text()}`)
  const tokens = await res.json()

  return {
    accessToken: tokens.access_token as string,
    refreshToken: tokens.refresh_token as string,
    realmId,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    refreshExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
  }
}

export async function refreshQuickBooksToken(refreshToken: string) {
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error(`QB token refresh failed: ${await res.text()}`)
  return res.json()
}

// ── QB API client ─────────────────────────────────────────────────────────────

class QuickBooksClient {
  private accessToken: string
  private realmId: string

  constructor(accessToken: string, realmId: string) {
    this.accessToken = accessToken
    this.realmId = realmId
  }

  private async request<T>(endpoint: string, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${getBaseUrl()}/company/${this.realmId}/${endpoint}`)
    url.searchParams.set('minorversion', '65')
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`QB API error ${res.status}: ${text}`)
    }
    return res.json()
  }

  async query<T>(sql: string): Promise<T[]> {
    const data = await this.request<any>('query', { query: sql })
    const entity = Object.keys(data.QueryResponse).find((k) => k !== 'startPosition' && k !== 'maxResults' && k !== 'totalCount')
    return entity ? data.QueryResponse[entity] ?? [] : []
  }

  async getCompanyInfo() {
    const data = await this.request<any>('companyinfo/' + this.realmId)
    return data.CompanyInfo
  }

  async getAccounts() {
    return this.query<QBAccount>('SELECT * FROM Account MAXRESULTS 1000')
  }

  async getCustomers() {
    return this.query<QBCustomer>('SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000')
  }

  async getVendors() {
    return this.query<QBVendor>('SELECT * FROM Vendor WHERE Active = true MAXRESULTS 1000')
  }

  async getInvoices(since?: Date) {
    const filter = since
      ? ` WHERE MetaData.LastUpdatedTime >= '${since.toISOString().split('T')[0]}'`
      : ''
    return this.query<QBInvoice>(`SELECT * FROM Invoice${filter} MAXRESULTS 1000`)
  }

  async getBills(since?: Date) {
    const filter = since
      ? ` WHERE MetaData.LastUpdatedTime >= '${since.toISOString().split('T')[0]}'`
      : ''
    return this.query<QBBill>(`SELECT * FROM Bill${filter} MAXRESULTS 1000`)
  }

  async getTransactions(since?: Date) {
    const filter = since
      ? ` WHERE MetaData.LastUpdatedTime >= '${since.toISOString().split('T')[0]}'`
      : ''
    return this.query<QBTransaction>(`SELECT * FROM Purchase${filter} MAXRESULTS 1000`)
  }

  async getPayments(since?: Date) {
    const filter = since
      ? ` WHERE MetaData.LastUpdatedTime >= '${since.toISOString().split('T')[0]}'`
      : ''
    return this.query<QBPayment>(`SELECT * FROM Payment${filter} MAXRESULTS 1000`)
  }

  async getProfitAndLoss(startDate: string, endDate: string) {
    const res = await this.request<any>('reports/ProfitAndLoss', {
      start_date: startDate,
      end_date: endDate,
      summarize_column_by: 'Month',
    })
    return res.Rows
  }

  async getBalanceSheet(asOf: string) {
    const res = await this.request<any>('reports/BalanceSheet', {
      as_of: asOf,
    })
    return res.Rows
  }
}

// ── QB types ──────────────────────────────────────────────────────────────────

interface QBAccount {
  Id: string
  Name: string
  AccountType: string
  AccountSubType: string
  CurrentBalance: number
  Active: boolean
}

interface QBCustomer {
  Id: string
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  Balance: number
}

interface QBVendor {
  Id: string
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
  Balance: number
}

interface QBInvoice {
  Id: string
  DocNumber: string
  TxnDate: string
  DueDate: string
  TotalAmt: number
  Balance: number
  CustomerRef: { value: string; name: string }
  Line: QBLineItem[]
}

interface QBBill {
  Id: string
  DocNumber?: string
  TxnDate: string
  DueDate: string
  TotalAmt: number
  Balance: number
  VendorRef: { value: string; name: string }
}

interface QBTransaction {
  Id: string
  TxnDate: string
  TotalAmt: number
  PaymentType: string
  EntityRef?: { value: string; name: string }
  AccountRef: { value: string; name: string }
  Line: QBLineItem[]
}

interface QBPayment {
  Id: string
  TxnDate: string
  TotalAmt: number
  CustomerRef: { value: string; name: string }
}

interface QBLineItem {
  Amount: number
  Description?: string
  DetailType: string
}

// ── Sync engine ───────────────────────────────────────────────────────────────

export class QuickBooksSync {
  private client: QuickBooksClient
  private businessId: string

  constructor(accessToken: string, realmId: string, businessId: string) {
    this.client = new QuickBooksClient(accessToken, realmId)
    this.businessId = businessId
  }

  async runFullSync(): Promise<SyncResult> {
    const result: SyncResult = { synced: {}, errors: [] }

    try {
      const [accounts, customers, vendors, invoices, bills, transactions] = await Promise.all([
        this.client.getAccounts(),
        this.client.getCustomers(),
        this.client.getVendors(),
        this.client.getInvoices(),
        this.client.getBills(),
        this.client.getTransactions(),
      ])

      result.synced.accounts = await this.syncAccounts(accounts)
      result.synced.customers = await this.syncCustomers(customers)
      result.synced.vendors = await this.syncVendors(vendors)
      result.synced.invoices = await this.syncInvoices(invoices)
      result.synced.bills = await this.syncBills(bills)
      result.synced.transactions = await this.syncTransactions(transactions)

      await db.integration.updateMany({
        where: { businessId: this.businessId, provider: 'quickbooks' },
        data: { lastSyncAt: new Date(), status: 'active' },
      })
    } catch (err: any) {
      result.errors.push(err.message)
    }

    return result
  }

  async runIncrementalSync(since: Date): Promise<SyncResult> {
    const result: SyncResult = { synced: {}, errors: [] }

    try {
      const [invoices, bills, transactions] = await Promise.all([
        this.client.getInvoices(since),
        this.client.getBills(since),
        this.client.getTransactions(since),
      ])

      result.synced.invoices = await this.syncInvoices(invoices)
      result.synced.bills = await this.syncBills(bills)
      result.synced.transactions = await this.syncTransactions(transactions)

      await db.integration.updateMany({
        where: { businessId: this.businessId, provider: 'quickbooks' },
        data: { lastSyncAt: new Date() },
      })
    } catch (err: any) {
      result.errors.push(err.message)
    }

    return result
  }

  private async syncAccounts(accounts: QBAccount[]) {
    let count = 0
    for (const acct of accounts) {
      await db.glAccount.upsert({
        where: {
          businessId_externalId: {
            businessId: this.businessId,
            externalId: `qb_${acct.Id}`,
          },
        },
        create: {
          businessId: this.businessId,
          externalId: `qb_${acct.Id}`,
          name: acct.Name,
          type: mapAccountType(acct.AccountType),
          subType: acct.AccountSubType,
          balance: acct.CurrentBalance,
          source: 'quickbooks',
        },
        update: {
          name: acct.Name,
          balance: acct.CurrentBalance,
        },
      }).catch(() => null)
      count++
    }
    return count
  }

  private async syncCustomers(customers: QBCustomer[]) {
    let count = 0
    for (const cust of customers) {
      await db.contact.upsert({
        where: {
          businessId_externalId: {
            businessId: this.businessId,
            externalId: `qb_cust_${cust.Id}`,
          },
        },
        create: {
          businessId: this.businessId,
          externalId: `qb_cust_${cust.Id}`,
          displayName: cust.DisplayName,
          email: cust.PrimaryEmailAddr?.Address,
          phone: cust.PrimaryPhone?.FreeFormNumber,
          type: 'customer',
          source: 'quickbooks',
          balance: cust.Balance,
        },
        update: {
          displayName: cust.DisplayName,
          email: cust.PrimaryEmailAddr?.Address,
          balance: cust.Balance,
        },
      }).catch(() => null)
      count++
    }
    return count
  }

  private async syncVendors(vendors: QBVendor[]) {
    let count = 0
    for (const vendor of vendors) {
      await db.vendor.upsert({
        where: {
          businessId_externalId: {
            businessId: this.businessId,
            externalId: `qb_vendor_${vendor.Id}`,
          },
        },
        create: {
          businessId: this.businessId,
          externalId: `qb_vendor_${vendor.Id}`,
          name: vendor.DisplayName,
          email: vendor.PrimaryEmailAddr?.Address,
          source: 'quickbooks',
          balance: vendor.Balance,
        },
        update: {
          name: vendor.DisplayName,
          email: vendor.PrimaryEmailAddr?.Address,
          balance: vendor.Balance,
        },
      }).catch(() => null)
      count++
    }
    return count
  }

  private async syncInvoices(invoices: QBInvoice[]) {
    let count = 0
    for (const inv of invoices) {
      await db.invoice.upsert({
        where: {
          businessId_externalId: {
            businessId: this.businessId,
            externalId: `qb_inv_${inv.Id}`,
          },
        },
        create: {
          businessId: this.businessId,
          externalId: `qb_inv_${inv.Id}`,
          invoiceNumber: inv.DocNumber,
          customerName: inv.CustomerRef.name,
          issueDate: new Date(inv.TxnDate),
          dueDate: new Date(inv.DueDate),
          total: inv.TotalAmt,
          balance: inv.Balance,
          status: inv.Balance === 0 ? 'paid' : inv.Balance < inv.TotalAmt ? 'partial' : 'open',
          source: 'quickbooks',
        },
        update: {
          balance: inv.Balance,
          status: inv.Balance === 0 ? 'paid' : inv.Balance < inv.TotalAmt ? 'partial' : 'open',
        },
      }).catch(() => null)
      count++
    }
    return count
  }

  private async syncBills(bills: QBBill[]) {
    let count = 0
    for (const bill of bills) {
      await db.bill.upsert({
        where: {
          businessId_externalId: {
            businessId: this.businessId,
            externalId: `qb_bill_${bill.Id}`,
          },
        },
        create: {
          businessId: this.businessId,
          externalId: `qb_bill_${bill.Id}`,
          billNumber: bill.DocNumber,
          vendorName: bill.VendorRef.name,
          issueDate: new Date(bill.TxnDate),
          dueDate: new Date(bill.DueDate),
          total: bill.TotalAmt,
          balance: bill.Balance,
          status: bill.Balance === 0 ? 'paid' : 'open',
          source: 'quickbooks',
        },
        update: {
          balance: bill.Balance,
          status: bill.Balance === 0 ? 'paid' : 'open',
        },
      }).catch(() => null)
      count++
    }
    return count
  }

  private async syncTransactions(transactions: QBTransaction[]) {
    let count = 0
    for (const txn of transactions) {
      await db.transaction.upsert({
        where: {
          businessId_externalId: {
            businessId: this.businessId,
            externalId: `qb_txn_${txn.Id}`,
          },
        },
        create: {
          businessId: this.businessId,
          externalId: `qb_txn_${txn.Id}`,
          date: new Date(txn.TxnDate),
          amount: -Math.abs(txn.TotalAmt),
          description: txn.EntityRef?.name ?? txn.Line[0]?.Description ?? 'QuickBooks transaction',
          accountName: txn.AccountRef.name,
          source: 'quickbooks',
          type: 'expense',
        },
        update: {},
      }).catch(() => null)
      count++
    }
    return count
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapAccountType(qbType: string): string {
  const map: Record<string, string> = {
    Asset: 'asset',
    Liability: 'liability',
    Equity: 'equity',
    Income: 'revenue',
    Expense: 'expense',
  }
  return map[qbType] ?? 'other'
}

interface SyncResult {
  synced: Record<string, number>
  errors: string[]
}

// ── Token management ──────────────────────────────────────────────────────────

export async function getValidQBTokens(businessId: string) {
  const integration = await db.integration.findFirst({
    where: { businessId, provider: 'quickbooks' },
  })
  if (!integration) throw new Error('QuickBooks not connected')

  // Refresh if expiring within 5 minutes
  if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date(Date.now() + 5 * 60_000)) {
    const fresh = await refreshQuickBooksToken(integration.refreshToken!)
    await db.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: fresh.access_token,
        refreshToken: fresh.refresh_token,
        tokenExpiresAt: new Date(Date.now() + fresh.expires_in * 1000),
      },
    })
    return { accessToken: fresh.access_token as string, realmId: integration.externalId! }
  }

  return { accessToken: integration.accessToken!, realmId: integration.externalId! }
}
