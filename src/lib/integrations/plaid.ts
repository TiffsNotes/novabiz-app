import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'
import { db } from '@/lib/db'
import type { PlaidTransaction } from '@/types'

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
})

export const plaidClient = new PlaidApi(config)

// ─── LINK TOKEN ─────────────────────────────────────────────

export async function createLinkToken(userId: string, businessId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'NovaBiz OS',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`,
    transactions: {
      days_requested: 730, // 2 years of history
    },
  })
  return response.data.link_token
}

// ─── EXCHANGE TOKEN ──────────────────────────────────────────

export async function exchangePublicToken(
  publicToken: string,
  businessId: string
) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  })

  const { access_token, item_id } = response.data

  // Get account details
  const accountsResponse = await plaidClient.accountsGet({
    access_token,
  })

  const accounts = accountsResponse.data.accounts

  // Store each account
  const savedAccounts = []
  for (const account of accounts) {
    const saved = await db.bankAccount.upsert({
      where: { plaidAccountId: account.account_id },
      create: {
        businessId,
        plaidAccountId: account.account_id,
        plaidItemId: item_id,
        plaidAccessToken: access_token, // TODO: encrypt with KMS
        name: account.name,
        mask: account.mask || undefined,
        type: account.type,
        subtype: account.subtype || undefined,
        currentBalance: account.balances.current
          ? Math.round(account.balances.current * 100)
          : undefined,
        availableBalance: account.balances.available
          ? Math.round(account.balances.available * 100)
          : undefined,
        institution: accountsResponse.data.item.institution_id || undefined,
      },
      update: {
        currentBalance: account.balances.current
          ? Math.round(account.balances.current * 100)
          : undefined,
        availableBalance: account.balances.available
          ? Math.round(account.balances.available * 100)
          : undefined,
        lastSync: new Date(),
      },
    })
    savedAccounts.push(saved)
  }

  return savedAccounts
}

// ─── SYNC TRANSACTIONS ───────────────────────────────────────

export async function syncTransactions(businessId: string) {
  const accounts = await db.bankAccount.findMany({
    where: { businessId, syncStatus: 'active' },
  })

  let totalSynced = 0

  for (const account of accounts) {
    try {
      const sinceDate = account.lastSync
        ? account.lastSync.toISOString().split('T')[0]
        : '2023-01-01' // Default: 1 year back for new connections

      // Use transactions/sync for incremental updates
      let cursor = undefined
      let hasMore = true
      const added: PlaidTransaction[] = []
      const modified: PlaidTransaction[] = []

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: account.plaidAccessToken,
          cursor,
          count: 500,
        })

        added.push(...(response.data.added as PlaidTransaction[]))
        modified.push(...(response.data.modified as PlaidTransaction[]))
        hasMore = response.data.has_more
        cursor = response.data.next_cursor
      }

      // Upsert transactions
      for (const tx of [...added, ...modified]) {
        await db.transaction.upsert({
          where: { plaidTxId: tx.transaction_id },
          create: {
            businessId,
            bankAccountId: account.id,
            plaidTxId: tx.transaction_id,
            date: new Date(tx.date),
            // Plaid: positive = debit (money out), we store: negative = debit
            amount: Math.round(tx.amount * -100),
            description: tx.name,
            merchantName: tx.merchant_name || undefined,
            categoryRaw: tx.category || [],
            pending: tx.pending,
          },
          update: {
            pending: tx.pending,
            amount: Math.round(tx.amount * -100),
          },
        })
        totalSynced++
      }

      // Update last sync time
      await db.bankAccount.update({
        where: { id: account.id },
        data: { lastSync: new Date(), syncError: null },
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await db.bankAccount.update({
        where: { id: account.id },
        data: { syncError: message },
      })
      console.error(`Plaid sync error for account ${account.id}:`, error)
    }
  }

  return { synced: totalSynced }
}

// ─── GET BALANCES ────────────────────────────────────────────

export async function refreshBalances(businessId: string) {
  const accounts = await db.bankAccount.findMany({
    where: { businessId },
  })

  const results = []
  for (const account of accounts) {
    const response = await plaidClient.accountsGet({
      access_token: account.plaidAccessToken,
    })

    for (const plaidAccount of response.data.accounts) {
      if (plaidAccount.account_id === account.plaidAccountId) {
        const updated = await db.bankAccount.update({
          where: { id: account.id },
          data: {
            currentBalance: plaidAccount.balances.current
              ? Math.round(plaidAccount.balances.current * 100)
              : undefined,
            availableBalance: plaidAccount.balances.available
              ? Math.round(plaidAccount.balances.available * 100)
              : undefined,
          },
        })
        results.push(updated)
      }
    }
  }

  return results
}
