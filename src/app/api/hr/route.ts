import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const view = new URL(req.url).searchParams.get('view') || 'employees'
    if (view === 'employees') {
      const employees = await db.employee.findMany({ where: { businessId: business.id }, include: { department: true }, orderBy: [{ status: 'asc' }, { lastName: 'asc' }] })
      return NextResponse.json({ employees })
    }
    if (view === 'stats') {
      const [headcount, departments] = await Promise.all([
        db.employee.count({ where: { businessId: business.id, status: 'active' } }),
        db.department.findMany({ where: { businessId: business.id } }),
      ])
      return NextResponse.json({ headcount, departments: departments.length, pendingLeave: 0, pendingExpenses: 0 })
    }
    if (view === 'departments') {
      const departments = await db.department.findMany({ where: { businessId: business.id }, include: { _count: { select: { employees: true } } } })
      return NextResponse.json({ departments })
    }
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  } catch (err: any) {
    console.error('HR API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    const { action } = body
    if (action === 'create_employee') {
      const { firstName, lastName, email, title, departmentId, startDate, employmentType, salary } = body
      const employee = await db.employee.create({ data: { businessId: business.id, firstName, lastName, email, title, departmentId: departmentId || null, startDate: startDate ? new Date(startDate) : new Date(), employmentType: employmentType || 'full_time', salary: salary ? parseFloat(salary) : null, status: 'active' } })
      return NextResponse.json({ success: true, employee })
    }
    if (action === 'terminate_employee') {
      await db.employee.update({ where: { id: body.employeeId }, data: { status: 'terminated', endDate: new Date() } })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
