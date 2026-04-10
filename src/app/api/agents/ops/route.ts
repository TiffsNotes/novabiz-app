import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []
      const now = new Date()

      // Check for pending leave requests older than 3 days
      const pendingLeave = await db.leaveRequest.findMany({
        where: {
          businessId: business.id,
          status: 'pending',
          createdAt: { lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
        },
        include: { employee: true },
        take: 10,
      }).catch(() => [])

      for (const leave of pendingLeave) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'leave_approval',
            title: 'Leave request pending: ' + (leave.employee?.firstName || '') + ' ' + (leave.employee?.lastName || ''),
            description: 'Leave request has been pending for 3+ days. Type: ' + leave.type + '. Dates: ' + new Date(leave.startDate).toLocaleDateString() + ' — ' + new Date(leave.endDate).toLocaleDateString(),
            severity: 'warning',
            module: 'hr',
            actionRequired: true,
            data: { leaveId: leave.id, employeeId: leave.employeeId },
          },
        }).catch(() => null)
        actions.push('Leave approval needed: ' + (leave.employee?.firstName || 'Employee'))
      }

      // Check for overdue project milestones
      const overdueProjects = await db.project.findMany({
        where: {
          businessId: business.id,
          status: 'active',
          deadline: { lt: now },
        },
        take: 10,
      }).catch(() => [])

      for (const project of overdueProjects) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'overdue_project',
            title: 'Project overdue: ' + project.name,
            description: 'Deadline was ' + project.deadline?.toLocaleDateString() + '. Review project status and update timeline.',
            severity: 'warning',
            module: 'projects',
            actionRequired: true,
            data: { projectId: project.id },
          },
        }).catch(() => null)
        actions.push('Overdue project: ' + project.name)
      }

      // Weekly headcount summary
      const [active, newThisWeek] = await Promise.all([
        db.employee.count({ where: { businessId: business.id, status: 'active' } }),
        db.employee.count({
          where: {
            businessId: business.id,
            createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
      ])

      if (newThisWeek > 0) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'headcount_update',
            title: newThisWeek + ' new employee(s) added this week',
            description: 'Total active headcount: ' + active + '. Ensure onboarding checklists are complete for new hires.',
            severity: 'info',
            module: 'hr',
            actionRequired: false,
            data: { newThisWeek, totalActive: active },
          },
        }).catch(() => null)
        actions.push('Headcount update: ' + newThisWeek + ' new hires')
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Ops agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
