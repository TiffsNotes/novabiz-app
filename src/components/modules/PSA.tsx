'use client'
import { useState, useEffect } from 'react'
import { Briefcase, Clock, DollarSign, Plus, ChevronDown, ChevronRight, CheckSquare, Circle, AlertCircle } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, EmptyState, Modal, Input, Select, ProgressBar } from '@/components/ui'

type Project = { id: string; name: string; code?: string; client?: string; status: string; type: string; budget?: number; actualCost: number; progress: number; health: string; startDate?: string; dueDate?: string; teamMembers: string[] }
type Task = { id: string; title: string; status: string; priority: string; assignee?: string; estimatedHours?: number; actualHours: number; dueDate?: string }
type Timesheet = { id: string; employee: string; project: string; task?: string; date: string; hours: number; billable: boolean; status: string; description?: string }
type Expense = { id: string; employee: string; project?: string; category: string; description: string; amount: number; date: string; status: string; billable: boolean }
type Stats = { activeProjects: number; billableHoursMtd: number; pendingTimesheets: number; pendingExpenses: number; totalRevenueMtd: number }

const fmtMoney = (c: number) => `$${(c/100).toLocaleString()}`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

const HEALTH_COLORS = { green: '#00a855', yellow: '#d97706', red: '#dc2626' }
const STATUS_VARIANTS: Record<string, 'green' | 'yellow' | 'blue' | 'red' | 'gray'> = {
  active: 'green', completed: 'green', planning: 'blue', on_hold: 'yellow', cancelled: 'red',
}

export default function PSAModule() {
  const [tab, setTab] = useState('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [newTimesheet, setNewTimesheet] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/psa?view=projects').then(r => r.ok ? r.json() : { projects: [] }),
      fetch('/api/psa?view=timesheets').then(r => r.ok ? r.json() : { timesheets: [] }),
      fetch('/api/psa?view=expenses').then(r => r.ok ? r.json() : { expenses: [] }),
      fetch('/api/psa?view=stats').then(r => r.ok ? r.json() : {}),
    ]).then(([p, t, e, s]) => {
      setProjects(p.projects || [])
      setTimesheets(t.timesheets || [])
      setExpenses(e.expenses || [])
      setStats(s)
    })
  }, [])

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Projects & PSA"
        subtitle="Project management, time tracking, resource planning, and billing"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Clock} onClick={() => setNewTimesheet(true)}>Log Time</Button>
            <Button size="sm" icon={Plus}>New Project</Button>
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-5 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
          <StatCard label="Active Projects" value={stats.activeProjects.toString()} color="#7c3aed" />
          <StatCard label="Billable Hours MTD" value={stats.billableHoursMtd.toFixed(1) + 'h'} color="#2563eb" />
          <StatCard label="Pending Timesheets" value={stats.pendingTimesheets.toString()} color="#d97706" />
          <StatCard label="Pending Expenses" value={stats.pendingExpenses.toString()} color="#0891b2" />
          <StatCard label="Revenue MTD" value={fmtMoney(stats.totalRevenueMtd)} color="#00a855" />
        </div>
      )}

      <Tabs tabs={[
        { key: 'projects', label: 'Projects', count: projects.filter(p => p.status === 'active').length },
        { key: 'timesheets', label: 'Timesheets', count: timesheets.filter(t => t.status === 'submitted').length },
        { key: 'expenses', label: 'Expenses', count: expenses.filter(e => e.status === 'pending').length },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4">
        {tab === 'projects' && (
          <div className="space-y-3">
            {projects.length === 0 ? (
              <EmptyState icon={Briefcase} title="No projects yet" description="Create your first project to start tracking time and billing clients." action={<Button size="sm" icon={Plus}>New Project</Button>} />
            ) : projects.map(proj => (
              <Card key={proj.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: HEALTH_COLORS[proj.health as keyof typeof HEALTH_COLORS] || '#6b7280' }} />
                      <h3 className="font-bold text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>{proj.name}</h3>
                      {proj.code && <span className="text-xs font-mono text-gray-400">{proj.code}</span>}
                      <Badge variant={STATUS_VARIANTS[proj.status] || 'gray'}>{proj.status}</Badge>
                      <Badge variant="blue">{proj.type.replace('_', ' ')}</Badge>
                    </div>
                    {proj.client && <div className="text-sm text-gray-500 mt-0.5">Client: {proj.client}</div>}
                  </div>
                  <Button variant="ghost" size="xs" onClick={() => setSelectedProject(proj.id === selectedProject ? null : proj.id)}>
                    {selectedProject === proj.id ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Budget</div>
                    <div className="font-semibold text-sm">{proj.budget ? fmtMoney(proj.budget) : 'T&M'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Spent</div>
                    <div className={`font-semibold text-sm ${proj.budget && proj.actualCost > proj.budget ? 'text-red-600' : ''}`}>{fmtMoney(proj.actualCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Timeline</div>
                    <div className="text-sm text-gray-600">{fmtDate(proj.startDate)} – {fmtDate(proj.dueDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Team</div>
                    <div className="text-sm text-gray-600">{proj.teamMembers.length} member{proj.teamMembers.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                <ProgressBar value={proj.progress} max={100} label="Progress" color={HEALTH_COLORS[proj.health as keyof typeof HEALTH_COLORS]} />
              </Card>
            ))}
          </div>
        )}

        {tab === 'timesheets' && (
          <Card padding={false}>
            <Table<Timesheet>
              columns={[
                { key: 'date', header: 'Date', render: r => <span className="text-sm text-gray-500">{fmtDate(r.date)}</span> },
                { key: 'employee', header: 'Employee', render: r => <span className="font-medium text-sm">{r.employee}</span> },
                { key: 'project', header: 'Project', render: r => (
                  <div>
                    <div className="text-sm text-gray-800">{r.project}</div>
                    {r.task && <div className="text-xs text-gray-400">{r.task}</div>}
                  </div>
                )},
                { key: 'hours', header: 'Hours', render: r => (
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold tabular-nums">{r.hours}h</span>
                    {r.billable && <Badge variant="green">Billable</Badge>}
                  </div>
                )},
                { key: 'description', header: 'Notes', render: r => <span className="text-xs text-gray-400 max-w-xs truncate block">{r.description || '—'}</span> },
                { key: 'status', header: 'Status', render: r => <Badge variant={r.status === 'approved' ? 'green' : r.status === 'submitted' ? 'yellow' : 'gray'}>{r.status}</Badge> },
              ]}
              data={timesheets}
              emptyMessage="No timesheets yet."
            />
          </Card>
        )}

        {tab === 'expenses' && (
          <Card padding={false}>
            <Table<Expense>
              columns={[
                { key: 'date', header: 'Date', render: r => <span className="text-sm text-gray-500">{fmtDate(r.date)}</span> },
                { key: 'employee', header: 'Employee', render: r => <span className="font-medium text-sm">{r.employee}</span> },
                { key: 'description', header: 'Description', render: r => (
                  <div>
                    <div className="text-sm text-gray-800">{r.description}</div>
                    <div className="text-xs text-gray-400">{r.category}</div>
                  </div>
                )},
                { key: 'project', header: 'Project', render: r => <span className="text-sm text-gray-500">{r.project || '—'}</span> },
                { key: 'amount', header: 'Amount', render: r => <span className="font-semibold tabular-nums">{fmtMoney(r.amount)}</span> },
                { key: 'billable', header: 'Billable', render: r => r.billable ? <Badge variant="green">Billable</Badge> : <span className="text-gray-300 text-xs">—</span> },
                { key: 'status', header: 'Status', render: r => <Badge variant={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'}>{r.status}</Badge> },
              ]}
              data={expenses}
              emptyMessage="No expenses submitted."
            />
          </Card>
        )}
      </div>

      <Modal open={newTimesheet} onClose={() => setNewTimesheet(false)} title="Log Time">
        <div className="p-6 space-y-4">
          <Input label="Date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
          <Select label="Project" value="" onChange={() => {}} options={[{ value: '', label: 'Select project...' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
          <Input label="Hours" type="number" step="0.5" placeholder="2.5" />
          <Input label="Description" placeholder="What did you work on?" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="billable" defaultChecked className="rounded" />
            <label htmlFor="billable" className="text-sm text-gray-700">Billable time</label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setNewTimesheet(false)}>Cancel</Button>
            <Button variant="primary" className="flex-1">Save Entry</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
