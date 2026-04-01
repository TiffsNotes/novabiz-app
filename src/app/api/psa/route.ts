import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { startOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const view = new URL(req.url).searchParams.get('view') || 'projects'

  if (view === 'projects') {
    const projects = await db.project.findMany({
      where: { businessId: business.id },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    })
    return NextResponse.json({
      projects: projects.map(p => ({
        id: p.id, name: p.name, code: p.code, status: p.status, type: p.type,
        budget: p.budget, actualCost: p.actualCost, progress: p.progress, health: p.health,
        startDate: p.startDate, dueDate: p.dueDate, teamMembers: p.teamMembers,
      })),
    })
  }

  if (view === 'timesheets') {
    const ts = await db.timesheet.findMany({
      where: { businessId: business.id },
      include: { employee: true, project: true, task: true },
      orderBy: { date: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      timesheets: ts.map(t => ({
        id: t.id,
        employee: t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : 'Unknown',
        project: t.project?.name || '—',
        task: t.task?.title,
        date: t.date, hours: t.hours, billable: t.billable,
        status: t.status, description: t.description,
      })),
    })
  }

  if (view === 'expenses') {
    const expenses = await db.expense.findMany({
      where: { businessId: business.id },
      include: { employee: true, project: true },
      orderBy: { date: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      expenses: expenses.map(e => ({
        id: e.id,
        employee: e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : 'Unknown',
        project: e.project?.name,
        category: e.category, description: e.description,
        amount: e.amount, date: e.date, status: e.status, billable: e.billable,
      })),
    })
  }

  if (view === 'stats') {
    const mtdStart = startOfMonth(new Date())
    const [active, pendingTs, pendingExp, billableHours] = await Promise.all([
      db.project.count({ where: { businessId: business.id, status: 'active' } }),
      db.timesheet.count({ where: { businessId: business.id, status: 'submitted' } }),
      db.expense.count({ where: { businessId: business.id, status: 'pending' } }),
      db.timesheet.aggregate({
        where: { businessId: business.id, billable: true, date: { gte: mtdStart }, status: 'approved' },
        _sum: { hours: true },
      }),
    ])
    return NextResponse.json({
      activeProjects: active, pendingTimesheets: pendingTs, pendingExpenses: pendingExp,
      billableHoursMtd: billableHours._sum.hours || 0,
      totalRevenueMtd: Math.round((billableHours._sum.hours || 0) * 15000), // $150/hr avg
    })
  }

  return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
}
