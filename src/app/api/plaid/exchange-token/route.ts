import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangePublicToken, syncTransactions } from '@/lib/integrations/plaid'
import { db } from '@/lib/db'
import { AutoBooksAgent } from '@/lib/ai/autobooks'
import { seedEstimatedSavings } from '@/lib/ai/savings'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { public_token } = await req.json()

  const business = await db.business.findUnique({
    where: { clerkOrgId: orgId },
  })

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // 1. Exchange token and save accounts
  const accounts = await exchangePublicToken(public_token, business.id)

  // 2. Sync transactions (async - don't wait)
  syncTransactions(business.id)
    .then(async ({ synced }) => {
      console.log(`Synced ${synced} transactions for ${business.id}`)

      // 3. Run AutoBooks on synced transactions
      const agent = new AutoBooksAgent(business.id)
      await agent.run()

      // 4. Seed initial savings estimates
      await seedEstimatedSavings(business.id)

      // 5. Update onboarding step
      await db.business.update({
        where: { id: business.id },
        data: { onboardingStep: 2 },
      })
    })
    .catch((err) => console.error('Background sync error:', err))

  return NextResponse.json({
    success: true,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.currentBalance,
    })),
    message: 'Accounts connected. Syncing transactions in background...',
  })
}
