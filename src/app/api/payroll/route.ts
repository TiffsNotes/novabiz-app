import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { PayrollAIAgent } from '@/lib/integrations/gusto'

export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const runs = await db.payrollRun.findMany({
    where: { businessId: business.id },
    include: { employees: { include: { employee: { select: { firstName: true, lastName: true } } } } },
    orderBy: { payDate: 'desc' },
    take: 20,
  })

  return NextResponse.json({
    runs: runs.map(r => ({
      ...r,
      employeeCount: r.employees.length,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { action, payrollRunId } = await req.json()
  const agent = new PayrollAIAgent(business.id)

  if (action === 'preview') {
    await agent.previewPayroll()
    return NextResponse.json({ success: true, message: 'Payroll preview created — check CommandInbox for approval.' })
  }

  if (action === 'execute' && payrollRunId) {
    await agent.executePayroll(payrollRunId)
    return NextResponse.json({ success: true })
  }

  if (action === 'sync_employees') {
    const count = await agent.syncEmployees()
    return NextResponse.json({ success: true, synced: count })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
