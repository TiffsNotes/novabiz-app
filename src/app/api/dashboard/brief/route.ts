import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found', id }, { status: 404 })

    return NextResponse.json({ 
      brief: `Good morning! Here's your NovaBiz OS daily brief for ${business.name}. Your integrations are connected and ready to sync.`,
      businessId: business.id,
      businessName: business.name
    })
  } catch (err: any) {
    console.error('Dashboard brief error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
