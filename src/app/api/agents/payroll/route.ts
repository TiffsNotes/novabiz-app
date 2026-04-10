import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []
      const now = new Date()
      const dayOfMonth = now.getDate()
      const dayOfWeek = now.getDay()

      // Get active employees
      const employees = await db.employee.findMany({
        where: { businessId: business.id, status: 'active' },
      })

      if (employees.length === 0) {
        results.push({ business: business.name, actions: ['No active employees'] })
        continue
      }

      const totalPayroll = employees.reduce((sum, e) => sum + ((e.salary || 0) / 12), 0)

      // Bi-weekly payroll reminder (1st and 15th)
      if (dayOfMonth === 1 || dayOfMonth === 15) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'payroll_run',
            title: 'Payroll run due — $' + (totalPayroll / 100).toFixed(0) + ' for ' + employees.length + ' employees',
            description: 'Bi-weekly payroll is scheduled for today. Review and approve to process payments. All employees will be paid via direct deposit.',
            severity: 'critical',
            module: 'payroll',
            actionRequired: true,
            data: {
              employeeCount: employees.length,
              totalAmount: totalPayroll,
              payPeriod: now.toLocaleDateString(),
            },
          },
        }).catch(() => null)
        actions.push('Payroll approval requested: $' + (totalPayroll / 100).toFixed(0))
      }

      // Check for employees missing bank info
      const missingBankInfo = employees.filter(e => !e.bankAccountNumber)
      if (missingBankInfo.length > 0) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'missing_bank_info',
            title: missingBankInfo.length + ' employee(s) missing direct deposit info',
            description: missingBankInfo.map(e => e.firstName + ' ' + e.lastName).join(', ') + ' — cannot process payroll until bank info is added.',
            severity: 'warning',
            module: 'payroll',
            actionRequired: true,
            data: { employeeIds: missingBankInfo.map(e => e.id) },
          },
        }).catch(() => null)
        actions.push('Missing bank info: ' + missingBankInfo.length + ' employees')
      }

      // Year-end W2 reminder in December
      if (now.getMonth() === 11) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'w2_reminder',
            title: 'Year-end payroll: W-2s due January 31',
            description: 'Prepare W-2 forms for ' + employees.length + ' employees. W-2s must be distributed by January 31. Review year-to-date payroll totals.',
            severity: 'warning',
            module: 'payroll',
            actionRequired: true,
            data: { employeeCount: employees.length, year: now.getFullYear() },
          },
        }).catch(() => null)
        actions.push('W-2 preparation reminder')
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Payroll agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
