'use client'
import { useState, useEffect } from 'react'
import { Users, Plus, Calendar, Star, DollarSign, Clock, Award, Activity } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, EmptyState, Modal, Input, Select } from '@/components/ui'

type Employee = { id: string; firstName: string; lastName: string; email: string; title?: string; department?: string; type: string; status: string; startDate?: string; payRate: number; payType: string }
type LeaveRequest = { id: string; employee: string; type: string; startDate: string; endDate: string; days: number; status: string; reason?: string }
type Review = { id: string; subject: string; reviewer?: string; period: string; type: string; status: string; overallScore?: number }
type HRStats = { headcount: number; ftCount: number; ptCount: number; contractorCount: number; pendingLeave: number; pendingExpenses: number; monthlyPayroll: number }

const fmtMoney = (c: number) => `$${(c/100).toLocaleString()}`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'

export default function HRModule() {
  const [tab, setTab] = useState('employees')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<HRStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [addEmployee, setAddEmployee] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/hr?view=employees').then(r => r.ok ? r.json() : { employees: [] }),
      fetch('/api/hr?view=leave').then(r => r.ok ? r.json() : { requests: [] }),
      fetch('/api/hr?view=reviews').then(r => r.ok ? r.json() : { reviews: [] }),
      fetch('/api/hr?view=stats').then(r => r.ok ? r.json() : {}),
    ]).then(([e, l, rv, s]) => {
      setEmployees(e.employees || [])
      setLeaves(l.requests || [])
      setReviews(rv.reviews || [])
      setStats(s)
      setLoading(false)
    })
  }, [])

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="HR & Employees"
        subtitle="Employee records, leave management, performance reviews, and benefits"
        actions={<Button icon={Plus} size="sm" onClick={() => setAddEmployee(true)}>Add Employee</Button>}
      />

      {stats && (
        <div className="grid grid-cols-5 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
          <StatCard label="Headcount" value={stats.headcount.toString()} sub={`${stats.ftCount} FT · ${stats.ptCount} PT · ${stats.contractorCount} contractors`} color="#2563eb" />
          <StatCard label="Monthly Payroll" value={fmtMoney(stats.monthlyPayroll)} color="#7c3aed" />
          <StatCard label="Pending Leave" value={stats.pendingLeave.toString()} sub="requests awaiting approval" color="#d97706" />
          <StatCard label="Pending Expenses" value={stats.pendingExpenses.toString()} sub="awaiting reimbursement" color="#0891b2" />
          <StatCard label="Avg Tenure" value="2.4 yrs" color="#059669" />
        </div>
      )}

      <Tabs tabs={[
        { key: 'employees', label: 'Employees', count: employees.length },
        { key: 'leave', label: 'Leave Requests', count: leaves.filter(l => l.status === 'pending').length },
        { key: 'reviews', label: 'Performance', count: reviews.length },
        { key: 'benefits', label: 'Benefits' },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4">
        {tab === 'employees' && (
          <Card padding={false}>
            <Table<Employee>
              columns={[
                { key: 'name', header: 'Employee', render: r => (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                      {r.firstName[0]}{r.lastName[0]}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{r.firstName} {r.lastName}</div>
                      <div className="text-xs text-gray-400">{r.email}</div>
                    </div>
                  </div>
                )},
                { key: 'title', header: 'Role', render: r => (
                  <div>
                    <div className="text-sm text-gray-700">{r.title || '—'}</div>
                    <div className="text-xs text-gray-400">{r.department || 'No department'}</div>
                  </div>
                )},
                { key: 'type', header: 'Type', render: r => (
                  <Badge variant={r.type === 'FULL_TIME' ? 'green' : r.type === 'CONTRACTOR' ? 'blue' : 'default'}>
                    {r.type.replace('_', ' ').toLowerCase()}
                  </Badge>
                )},
                { key: 'pay', header: 'Compensation', render: r => (
                  <div>
                    <div className="font-medium text-sm text-gray-800">{fmtMoney(r.payRate)}</div>
                    <div className="text-xs text-gray-400">/{r.payType === 'salary' ? 'year' : 'hour'}</div>
                  </div>
                )},
                { key: 'startDate', header: 'Start Date', render: r => <span className="text-sm text-gray-500">{fmtDate(r.startDate)}</span> },
                { key: 'status', header: 'Status', render: r => <Badge variant={r.status === 'active' ? 'green' : 'gray'}>{r.status}</Badge> },
              ]}
              data={employees}
              emptyMessage="No employees yet. Add your first employee or sync from Gusto."
            />
          </Card>
        )}

        {tab === 'leave' && (
          <div className="space-y-3">
            {leaves.filter(l => l.status === 'pending').length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="font-semibold text-amber-800 text-sm mb-2">{leaves.filter(l => l.status === 'pending').length} requests need your approval</div>
                <div className="space-y-2">
                  {leaves.filter(l => l.status === 'pending').map(l => (
                    <div key={l.id} className="bg-white rounded-lg border border-amber-100 p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-800">{l.employee}</div>
                        <div className="text-xs text-gray-500">{l.type} · {fmtDate(l.startDate)} – {fmtDate(l.endDate)} · {l.days} day{l.days !== 1 ? 's' : ''}</div>
                        {l.reason && <div className="text-xs text-gray-400 mt-0.5">"{l.reason}"</div>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="xs" variant="success">Approve</Button>
                        <Button size="xs" variant="secondary">Decline</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Card padding={false}>
              <Table<LeaveRequest>
                columns={[
                  { key: 'employee', header: 'Employee', render: r => <span className="font-medium text-sm">{r.employee}</span> },
                  { key: 'type', header: 'Type', render: r => <Badge variant="blue">{r.type}</Badge> },
                  { key: 'dates', header: 'Dates', render: r => <span className="text-sm text-gray-500">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span> },
                  { key: 'days', header: 'Days', render: r => <span className="font-medium">{r.days}</span> },
                  { key: 'status', header: 'Status', render: r => (
                    <Badge variant={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'}>
                      {r.status}
                    </Badge>
                  )},
                ]}
                data={leaves}
                emptyMessage="No leave requests."
              />
            </Card>
          </div>
        )}

        {tab === 'reviews' && (
          <Card padding={false}>
            <Table<Review>
              columns={[
                { key: 'subject', header: 'Employee', render: r => <span className="font-medium text-sm">{r.subject}</span> },
                { key: 'type', header: 'Type', render: r => <Badge variant="blue">{r.type}</Badge> },
                { key: 'period', header: 'Period', render: r => <span className="text-sm text-gray-500">{r.period}</span> },
                { key: 'status', header: 'Status', render: r => <Badge variant={r.status === 'completed' ? 'green' : 'yellow'}>{r.status}</Badge> },
                { key: 'overallScore', header: 'Score', render: r => r.overallScore ? (
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                    <span className="font-medium text-sm">{r.overallScore.toFixed(1)}/5</span>
                  </div>
                ) : <span className="text-gray-300 text-sm">—</span> },
              ]}
              data={reviews}
              emptyMessage="No performance reviews. Start a review cycle for your team."
            />
          </Card>
        )}

        {tab === 'benefits' && (
          <EmptyState icon={Award} title="Benefits Administration" description="Configure health, dental, vision, and 401k plans. Coming soon." />
        )}
      </div>

      <Modal open={addEmployee} onClose={() => setAddEmployee(false)} title="Add Employee">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" placeholder="Jane" />
            <Input label="Last name" placeholder="Smith" />
          </div>
          <Input label="Work email" type="email" placeholder="jane@company.com" />
          <Input label="Job title" placeholder="Operations Manager" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Employment type" value="FULL_TIME" onChange={() => {}} options={[
              { value: 'FULL_TIME', label: 'Full-time' },
              { value: 'PART_TIME', label: 'Part-time' },
              { value: 'CONTRACTOR', label: 'Contractor' },
            ]} />
            <Select label="Pay type" value="salary" onChange={() => {}} options={[
              { value: 'salary', label: 'Salary' },
              { value: 'hourly', label: 'Hourly' },
            ]} />
          </div>
          <Input label="Annual salary or hourly rate" type="number" placeholder="65000" />
          <Input label="Start date" type="date" />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAddEmployee(false)}>Cancel</Button>
            <Button variant="primary" className="flex-1">Save Employee</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
