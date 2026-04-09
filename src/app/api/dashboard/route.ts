import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getExecutiveDashboard } from '@/lib/ai/bi'

export async function GET() {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dashboard = await getExecutiveDashboard(business.id)
  return NextResponse.json(dashboard)
}
