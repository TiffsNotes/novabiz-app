import { db } from '@/lib/db'
import { createAiAction } from '@/lib/ai/actions'
import { recordSaving } from '@/lib/ai/savings'
import axios from 'axios'

const GUSTO_BASE = 'https://api.gusto.com/v1'

// ─── GUSTO API CLIENT ────────────────────────────────────────

class GustoClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async get(path: string) {
    const res = await axios.get(`${GUSTO_BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
    return res.data
  }

  async post(path: string, data: unknown) {
    const res = await axios.post(`${GUSTO_BASE}${path}`, data, {
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
    })
    return res.data
  }

  async put(path: string, data: unknown) {
    const res = await axios.put(`${GUSTO_BASE}${path}`, data, {
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
    })
    return res.data
  }
}

// ─── PAYROLL AI AGENT ────────────────────────────────────────

export class PayrollAIAgent {
  private businessId: string

  constructor(businessId: string) {
    this.businessId = businessId
  }

  // Sync employees from Gusto
  async syncEmployees(): Promise<number> {
    const gusto = await this.getGustoClient()
    if (!gusto) return 0

    const integration = await db.integration.findUnique({
      where: { businessId_type: { businessId: this.businessId, type: 'gusto' } },
    })

    const companyId = (integration?.metadata as Record<string, string>)?.companyId
    if (!companyId) return 0

    const employees = await gusto.get(`/companies/${companyId}/employees`)

    let synced = 0
    for (const emp of employees) {
      await db.employee.upsert({
        where: { gustoId: emp.uuid },
        create: {
          businessId: this.businessId,
          gustoId: emp.uuid,
          firstName: emp.first_name,
          lastName: emp.last_name,
          email: emp.email || '',
          type: this.mapEmployeeType(emp.employment_status),
          status: emp.terminated ? 'terminated' : 'active',
          startDate: emp.start_date ? new Date(emp.start_date) : undefined,
          title: emp.jobs?.[0]?.title,
          payRate: emp.jobs?.[0]?.rate ? Math.round(parseFloat(emp.jobs[0].rate) * 100) : 0,
          payType: emp.jobs?.[0]?.payment_unit === 'Year' ? 'salary' : 'hourly',
        },
        update: {
          status: emp.terminated ? 'terminated' : 'active',
          payRate: emp.jobs?.[0]?.rate ? Math.round(parseFloat(emp.jobs[0].rate) * 100) : 0,
        },
      })
      synced++
    }

    return synced
  }

  // Preview upcoming payroll — creates inbox item for approval
  async previewPayroll(): Promise<void> {
    const gusto = await this.getGustoClient()
    if (!gusto) return

    const integration = await db.integration.findUnique({
      where: { businessId_type: { businessId: this.businessId, type: 'gusto' } },
    })

    const companyId = (integration?.metadata as Record<string, string>)?.companyId
    if (!companyId) return

    // Get unprocessed pay periods
    const payPeriods = await gusto.get(`/companies/${companyId}/pay_periods`)
    const upcoming = payPeriods.find((p: Record<string, string>) => p.payroll_deadline && new Date(p.payroll_deadline) > new Date())
    if (!upcoming) return

    // Get payroll preview
    const payroll = await gusto.get(
      `/companies/${companyId}/payrolls/${upcoming.start_date}/${upcoming.end_date}`
    )

    const totalGross = payroll.employee_compensations?.reduce(
      (sum: number, e: Record<string, string>) => sum + parseFloat(e.gross_pay || '0'), 0
    ) || 0

    const totalCents = Math.round(totalGross * 100)
    const employeeCount = payroll.employee_compensations?.length || 0
    const payDate = new Date(upcoming.check_date)

    // Create payroll run record
    const run = await db.payrollRun.create({
      data: {
        businessId: this.businessId,
        runNumber: `PR-${Date.now()}`,
        payPeriodStart: new Date(upcoming.start_date),
        payPeriodEnd: new Date(upcoming.end_date),
        payDate,
        totalGross: totalCents,
        totalNet: Math.round(totalCents * 0.72), // estimate
        totalTaxes: Math.round(totalCents * 0.2),
        totalDeductions: Math.round(totalCents * 0.08),
        status: 'pending',
      },
    })

    // Create AI action requiring approval
    const action = await createAiAction({
      businessId: this.businessId,
      module: 'PAYROLL',
      actionType: 'run_payroll',
      title: `Payroll run — ${payDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      description: `${employeeCount} employees · Pay period: ${upcoming.start_date} – ${upcoming.end_date}`,
      payload: { payrollRunId: run.id, gustoPayPeriod: upcoming },
      requiresApproval: true,
      approvalReason: 'All payroll runs require your approval before processing',
      amount: totalCents,
      status: 'PENDING_APPROVAL',
    })

    await db.inboxItem.create({
      data: {
        businessId: this.businessId,
        actionId: action.id,
        title: `Approve payroll — ${payDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
        description: `$${(totalCents / 100).toLocaleString()} · ${employeeCount} employees · Deadline: ${payroll.payroll_deadline}`,
        module: 'PAYROLL',
        urgency: 'HIGH',
        amount: totalCents,
        dueAt: new Date(payroll.payroll_deadline),
      },
    })
  }

  // Execute approved payroll via Gusto
  async executePayroll(payrollRunId: string): Promise<void> {
    const run = await db.payrollRun.findUniqueOrThrow({ where: { id: payrollRunId } })
    const gusto = await this.getGustoClient()
    if (!gusto) throw new Error('Gusto not connected')

    const integration = await db.integration.findUnique({
      where: { businessId_type: { businessId: this.businessId, type: 'gusto' } },
    })
    const companyId = (integration?.metadata as Record<string, string>)?.companyId

    // Submit to Gusto
    await gusto.put(`/companies/${companyId}/payrolls`, {
      payroll_deadline: run.payDate.toISOString().split('T')[0],
    })

    await db.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'processing', processedAt: new Date() },
    })

    // Record savings (replacing manual payroll service)
    await recordSaving({
      businessId: this.businessId,
      module: 'PAYROLL',
      category: 'service_replaced',
      amount: 15000, // $150 typical payroll service fee
      description: 'Payroll processed via PayrollAI (replaced Gusto full-service fee)',
      recurring: true,
      vendorName: 'Payroll Service',
    })
  }

  // Get payroll summary for dashboard
  async getPayrollSummary() {
    const [runs, employees] = await Promise.all([
      db.payrollRun.findMany({
        where: { businessId: this.businessId },
        orderBy: { payDate: 'desc' },
        take: 12,
      }),
      db.employee.findMany({
        where: { businessId: this.businessId, status: 'active' },
        select: { id: true, type: true, payRate: true, payType: true, department: true },
      }),
    ])

    const totalAnnualPayroll = employees.reduce((sum, e) => {
      if (e.payType === 'salary') return sum + e.payRate
      return sum + (e.payRate * 40 * 52) // hourly * 40hrs * 52 weeks
    }, 0)

    const lastRun = runs[0]
    const ytdPayroll = runs.reduce((sum, r) => sum + r.totalGross, 0)

    return {
      employeeCount: employees.length,
      ftCount: employees.filter(e => e.type === 'FULL_TIME').length,
      ptCount: employees.filter(e => e.type === 'PART_TIME').length,
      contractorCount: employees.filter(e => e.type === 'CONTRACTOR').length,
      totalAnnualPayroll,
      estimatedMonthlyPayroll: Math.round(totalAnnualPayroll / 12),
      ytdPayroll,
      lastRunDate: lastRun?.payDate,
      lastRunAmount: lastRun?.totalGross,
      nextPayDate: this.getNextPayDate(),
      recentRuns: runs.slice(0, 6),
    }
  }

  private getNextPayDate(): Date {
    const now = new Date()
    // Bi-weekly: next Friday
    const next = new Date(now)
    next.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 14))
    return next
  }

  private mapEmployeeType(status: string): 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN' {
    if (status === 'Part-Time') return 'PART_TIME'
    if (status === 'Contractor') return 'CONTRACTOR'
    return 'FULL_TIME'
  }

  private async getGustoClient(): Promise<GustoClient | null> {
    const integration = await db.integration.findUnique({
      where: { businessId_type: { businessId: this.businessId, type: 'gusto' } },
    })
    if (!integration) return null
    const creds = integration.credentials as Record<string, string>
    return new GustoClient(creds.accessToken)
  }
}
