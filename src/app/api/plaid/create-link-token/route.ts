import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createLinkToken } from '@/lib/integrations/plaid'
import { db } from '@/lib/db'

export async function POST() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const business = await db.business.findUnique({
    where: { clerkOrgId: orgId },
  })

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const linkToken = await createLinkToken(userId, business.id)
  return NextResponse.json({ link_token: linkToken })
}
