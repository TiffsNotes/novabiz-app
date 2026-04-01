'use client'
import { useState, useEffect } from 'react'
import { UserCheck, Play, CheckCircle, Clock, DollarSign, Calendar, Users, AlertTriangle, Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, EmptyState, Modal } from '@/components/ui'

type PayrollRun = { id: string; runNumber: string; payPeriodStart: string; payPeriodEnd: string; payDate: string; totalGross: number; totalNet: number; totalTaxes: number; status: string; employeeCount?: number }
type Employee = { id: string; firstName: string; lastName: string; payRate: number; payType: string; type: string; grossPay?: number; netPay?: number }
type Summary = { employeeCount: number; ftCount: number; ptCount: number; contractorCount: number; estimatedMonthlyPayroll: number; ytdPayroll: number; lastRunDate?: string; lastRunAmount?: number; nextPayDate?: string; recentRuns: PayrollRun[] }

const fmt = (c: number) => `$${(c / 100).toLocaleString()}`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtShort = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

export default function PayrollModule() {
  const [tab, setTab] = useState('overview')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [runningPayroll, setRunningPayroll] = useState(false)
  const [confirmRun, setConfirmRun] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/hr?view=payroll').then(r => r.ok ? r.json() : {}),
      fetch('/api/hr?view=employees').then(r => r.ok ? r.json() : { employees: [] }),
    ]).then(([p, e]) => {
      setSummary(p)
      setRuns(p.recentRuns || [])
      setEmployees(e.employees || [])
      setLoading(false)
    })
  }, [])

  const triggerPayroll = async () => {
    setRunningPayroll(true)
    setConfirmRun(false)
    const res = await fetch('/api/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview' }) })
    setRunningPayroll(false)
    // Refresh to see inbox item
    window.location.href = '/dashboard/inbox'
  }

  const chartData = (runs || []).slice(0, 6).reverse().map(r => ({
    period: fmtShort(r.payDate),
    gross: r.totalGross / 100,
    taxes: r.totalTaxes / 100,
    net: r.totalNet / 100,
  }))

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="PayrollAI"
        subtitle="Automated payroll processing, tax filings, and employee compensation management"
        actions={
          <Button icon={Play} size="sm" variant="success" loading={runningPayroll} onClick={() => setConfirmRun(true)}>
            Preview Next Payroll
          </Button>
        }
      />

      {summary && (
        <div className="grid grid-cols-5 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
          <StatCard label="Headcount" value={summary.employeeCount.toString()} sub={`${summary.ftCount} FT · ${summary.ptCount} PT · ${summary.contractorCount} contractor${summary.contractorCount !== 1 ? 's' : ''}`} color="#7c3aed" />
          <StatCard label="Monthly Payroll" value={fmt(summary.estimatedMonthlyPayroll)} sub="estimated" color="#2563eb" />
          <StatCard label="YTD Payroll" value={fmt(summary.ytdPayroll)} color="#0891b2" />
          <StatCard label="Last Run" value={fmt(summary.lastRunAmount || 0)} sub={fmtDate(summary.lastRunDate)} color="#059669" />
          <StatCard label="Next Pay Date" value={fmtShort(summary.nextPayDate) || 'TBD'} sub="scheduled" color="#00a855" icon={Calendar} />
        </div>
      )}

      <Tabs tabs={[
        { key: 'overview', label: 'Overview' },
        { key: 'runs', label: 'Payroll History', count: runs.length },
        { key: 'employees', label: 'Pay Rates', count: employees.length },
        { key: 'taxes', label: 'Tax Filings' },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {tab === 'overview' && (
          <>
            {/* Next payroll card */}
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Next Payroll</div>
                  <h3 className="text-xl font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                    {fmtDate(summary?.nextPayDate)}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Estimated: {fmt(summary?.estimatedMonthlyPayroll ? summary.estimatedMonthlyPayroll / 2 : 0)} · {summary?.employeeCount || 0} employees</p>
                </div>
                <div className="bg-[#e8f8f0] border border-[#00a855]/20 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-[#00a855]" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>AI</div>
                  <div className="text-xs text-[#007a3d]">Auto-scheduled</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: 'Gross pay', value: fmt(summary?.estimatedMonthlyPayroll ? summary.estimatedMonthlyPayroll / 2 : 0) },
                  { label: 'Taxes (est)', value: fmt(summary?.estimatedMonthlyPayroll ? Math.round(summary.estimatedMonthlyPayroll * 0.1) : 0) },
                  { label: 'Net pay', value: fmt(summary?.estimatedMonthlyPayroll ? Math.round(summary.estimatedMonthlyPayroll * 0.36) : 0) },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">{item.label}</div>
                    <div className="font-bold text-gray-900">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="success" icon={Play} onClick={() => setConfirmRun(true)} loading={runningPayroll}>Run Payroll</Button>
                <Button size="sm" variant="secondary" icon={Download}>Download Preview</Button>
              </div>
            </Card>

            {/* Payroll trend chart */}
            {chartData.length > 0 && (
              <Card>
                <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Payroll Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="gross" fill="#7c3aed" name="Gross" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="taxes" fill="#e9d5ff" name="Taxes" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Tax Set-Aside (Q)</div>
                <div className="text-xl font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                  {fmt(summary?.ytdPayroll ? Math.round(summary.ytdPayroll * 0.08) : 0)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Recommended quarterly reserve</div>
              </Card>
              <Card>
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Benefits Cost</div>
                <div className="text-xl font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                  {fmt(summary?.estimatedMonthlyPayroll ? Math.round(summary.estimatedMonthlyPayroll * 0.18) : 0)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Estimated monthly (health, 401k)</div>
              </Card>
              <Card>
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Contractor Payments</div>
                <div className="text-xl font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                  {fmt(0)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Pending 1099 filings: {summary?.contractorCount || 0}</div>
              </Card>
            </div>
          </>
        )}

        {tab === 'runs' && (
          <Card padding={false}>
            <Table<PayrollRun>
              columns={[
                { key: 'runNumber', header: 'Run #', render: r => <span className="font-mono text-xs text-gray-500">{r.runNumber}</span> },
                { key: 'period', header: 'Pay Period', render: r => (
                  <span className="text-sm text-gray-700">{fmtShort(r.payPeriodStart)} – {fmtShort(r.payPeriodEnd)}</span>
                )},
                { key: 'payDate', header: 'Pay Date', render: r => <span className="text-sm">{fmtDate(r.payDate)}</span> },
                { key: 'employees', header: 'Employees', render: r => <span className="font-medium">{r.employeeCount || '—'}</span> },
                { key: 'totalGross', header: 'Gross', render: r => <span className="font-semibold tabular-nums">{fmt(r.totalGross)}</span> },
                { key: 'totalTaxes', header: 'Taxes', render: r => <span className="tabular-nums text-gray-600">{fmt(r.totalTaxes)}</span> },
                { key: 'totalNet', header: 'Net', render: r => <span className="font-bold tabular-nums text-[#00a855]">{fmt(r.totalNet)}</span> },
                { key: 'status', header: 'Status', render: r => (
                  <Badge variant={r.status === 'completed' ? 'green' : r.status === 'processing' ? 'blue' : r.status === 'failed' ? 'red' : 'yellow'}>
                    {r.status}
                  </Badge>
                )},
              ]}
              data={runs}
              emptyMessage="No payroll runs yet. Run your first payroll to get started."
            />
          </Card>
        )}

        {tab === 'employees' && (
          <Card padding={false}>
            <Table<Employee>
              columns={[
                { key: 'name', header: 'Employee', render: r => (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-sm font-semibold text-purple-600">
                      {r.firstName[0]}{r.lastName[0]}
                    </div>
                    <span className="font-medium text-gray-900">{r.firstName} {r.lastName}</span>
                  </div>
                )},
                { key: 'type', header: 'Type', render: r => (
                  <Badge variant={r.type === 'FULL_TIME' ? 'green' : r.type === 'CONTRACTOR' ? 'blue' : 'default'}>
                    {r.type.replace('_', ' ').toLowerCase()}
                  </Badge>
                )},
                { key: 'payRate', header: 'Rate', render: r => (
                  <div>
                    <div className="font-semibold">{fmt(r.payRate)}</div>
                    <div className="text-xs text-gray-400">/{r.payType === 'salary' ? 'year' : 'hour'}</div>
                  </div>
                )},
                { key: 'annualized', header: 'Annualized', render: r => (
                  <span className="tabular-nums font-medium">
                    {r.payType === 'salary' ? fmt(r.payRate) : fmt(r.payRate * 40 * 52)}
                  </span>
                )},
                { key: 'monthly', header: 'Monthly Est.', render: r => (
                  <span className="tabular-nums text-gray-600">
                    {r.payType === 'salary' ? fmt(Math.round(r.payRate / 12)) : fmt(Math.round(r.payRate * 40 * 4.33))}
                  </span>
                )},
              ]}
              data={employees}
              emptyMessage="No employees. Add employees or sync from Gusto."
            />
          </Card>
        )}

        {tab === 'taxes' && (
          <EmptyState
            icon={CheckCircle}
            title="Tax compliance is automated"
            description="ComplianceGuard tracks all federal, state, and local tax deadlines. Connect Gusto to enable automatic filings."
            action={<Button size="sm" variant="secondary">Configure Tax Settings</Button>}
          />
        )}
      </div>

      <Modal open={confirmRun} onClose={() => setConfirmRun(false)} title="Confirm Payroll Run">
        <div className="p-6">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              This will process payroll for <strong>{summary?.employeeCount} employees</strong> and initiate direct deposit transfers. This action requires your explicit approval.
            </div>
          </div>
          <div className="space-y-2 mb-6">
            {[
              { label: 'Estimated gross', value: fmt(summary?.estimatedMonthlyPayroll ? Math.round(summary.estimatedMonthlyPayroll / 2) : 0) },
              { label: 'Estimated taxes', value: fmt(summary?.estimatedMonthlyPayroll ? Math.round(summary.estimatedMonthlyPayroll * 0.1) : 0) },
              { label: 'Employees', value: String(summary?.employeeCount || 0) },
              { label: 'Pay date', value: fmtDate(summary?.nextPayDate) },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmRun(false)}>Cancel</Button>
            <Button variant="success" className="flex-1" icon={Play} loading={runningPayroll} onClick={triggerPayroll}>
              Approve & Run
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
