import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []
      const now = new Date()
      const month = now.getMonth() + 1
      const day = now.getDate()

      // Quarterly estimated tax deadlines
      const quarterlyDeadlines = [
        { month: 4, day: 15, label: 'Q1 Estimated Tax Payment (Federal)' },
        { month: 6, day: 15, label: 'Q2 Estimated Tax Payment (Federal)' },
        { month: 9, day: 15, label: 'Q3 Estimated Tax Payment (Federal)' },
        { month: 1, day: 15, label: 'Q4 Estimated Tax Payment (Federal)' },
      ]

      for (const deadline of quarterlyDeadlines) {
        const daysUntil = Math.floor(
          (new Date(now.getFullYear(), deadline.month - 1, deadline.day).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        )

        if (daysUntil >= 0 && daysUntil <= 30) {
          await db.agentAlert.create({
            data: {
              businessId: business.id,
              type: 'tax_deadline',
              title: deadline.label + ' due in ' + daysUntil + ' days',
              description: 'Estimated tax payment due ' + new Date(now.getFullYear(), deadline.month - 1, deadline.day).toLocaleDateString() + '. Review with your accountant to determine amount owed.',
              severity: daysUntil <= 7 ? 'critical' : 'warning',
              module: 'compliance',
              actionRequired: true,
              data: { deadline, daysUntil },
            },
          }).catch(() => null)
          actions.push('Tax deadline alert: ' + deadline.label)
        }
      }

      // Monthly payroll tax deposit reminder
      if (day === 10 || day === 15) {
        await db.agentAlert.create({
          data: {
            businessId: business.id,
            type: 'payroll_tax',
            title: 'Payroll tax deposit reminder',
            description: 'Monthly payroll tax deposits are typically due by the 15th. Ensure federal and state payroll taxes have been deposited.',
            severity: 'info',
            module: 'compliance',
            actionRequired: false,
            data: { month, year: now.getFullYear() },
          },
        }).catch(() => null)
        actions.push('Payroll tax deposit reminder')
      }

      // Annual filing reminders
      if (month === 1 && day <= 31) {
        await db.agentAlert.create({
          data: {
            businessId: business.id,
            type: 'annual_filing',
            title: 'W-2 and 1099 forms due January 31',
            description: 'W-2s must be sent to employees and 1099s to contractors by January 31. File copies with the IRS by the same date.',
            severity: 'critical',
            module: 'compliance',
            actionRequired: true,
            data: { year: now.getFullYear() },
          },
        }).catch(() => null)
        actions.push('W-2/1099 deadline reminder')
      }

      if (month === 3 && day <= 15) {
        await db.agentAlert.create({
          data: {
            businessId: business.id,
            type: 'annual_filing',
            title: 'S-Corp/Partnership tax return due March 15',
            description: 'If your business is an S-Corp or Partnership, your tax return (Form 1120-S or 1065) is due March 15. File for an extension if needed.',
            severity: 'warning',
            module: 'compliance',
            actionRequired: true,
            data: { year: now.getFullYear() },
          },
        }).catch(() => null)
        actions.push('S-Corp/Partnership filing reminder')
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Compliance agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
