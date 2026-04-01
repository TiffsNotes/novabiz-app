import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { PayrollAIAgent } from '@/lib/integrations/gusto'
import { startOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const view = new URL(req.url).searchParams.get('view') || 'employees'

  if (view === 'employees') {
    const employees = await db.employee.findMany({
      where: { businessId: business.id },
      include: { department: true },
      orderBy: [{ status: 'asc' }, { lastName: 'asc' }],
    })
    return NextResponse.json({
      employees: employees.map(e => ({
        id: e.id, firstName: e.firstName, lastName: e.lastName,
        email: e.email, title: e.title, type: e.type, status: e.status,
        department: e.department?.name, payRate: e.payRate, payType: e.payType,
        startDate: e.startDate,
      })),
    })
  }

  if (view === 'leave') {
    const requests = await db.leaveRequest.findMany({
      where: { businessId: business.id },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({
      requests: requests.map(r => ({
        id: r.id, employee: `${r.employee.firstName} ${r.employee.lastName}`,
        type: r.type, startDate: r.startDate, endDate: r.endDate,
        days: r.days, status: r.status, reason: r.reason,
      })),
    })
  }

  if (view === 'reviews') {
    const reviews = await db.performanceReview.findMany({
      where: { businessId: business.id },
      include: { subject: true, reviewer: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      reviews: reviews.map(r => ({
        id: r.id,
        subject: `${r.subject.firstName} ${r.subject.lastName}`,
        reviewer: r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : undefined,
        period: r.period, type: r.type, status: r.status, overallScore: r.overallScore,
      })),
    })
  }

  if (view === 'payroll') {
    const agent = new PayrollAIAgent(business.id)
    return NextResponse.json(await agent.getPayrollSummary())
  }

  if (view === 'stats') {
    const [active, ft, pt, contractor, pendingLeave, pendingExpenses, payroll] = await Promise.all([
      db.employee.count({ where: { businessId: business.id, status: 'active' } }),
      db.employee.count({ where: { businessId: business.id, status: 'active', type: 'FULL_TIME' } }),
      db.employee.count({ where: { businessId: business.id, status: 'active', type: 'PART_TIME' } }),
      db.employee.count({ where: { businessId: business.id, status: 'active', type: 'CONTRACTOR' } }),
      db.leaveRequest.count({ where: { businessId: business.id, status: 'pending' } }),
      db.expense.count({ where: { businessId: business.id, status: 'pending' } }),
      db.payrollRun.aggregate({
        where: { businessId: business.id, payDate: { gte: startOfMonth(new Date()) }, status: { in: ['completed', 'processing'] } },
        _sum: { totalGross: true },
      }),
    ])
    return NextResponse.json({
      headcount: active, ftCount: ft, ptCount: pt, contractorCount: contractor,
      pendingLeave, pendingExpenses, monthlyPayroll: payroll._sum.totalGross || 0,
    })
  }

  return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
}
