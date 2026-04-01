'use client'
import { useState, useEffect } from 'react'
import { BarChart3, Download, RefreshCw, Play, TrendingUp, DollarSign, Users, Package, Briefcase, ShoppingCart } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { PageHeader, Card, StatCard, Badge, Tabs, Button, Select, EmptyState } from '@/components/ui'

const COLORS = ['#00a855', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#059669', '#d946ef']

type ReportType = 'pl' | 'ar_aging' | 'inventory' | 'payroll_summary' | 'sales_pipeline' | 'project_utilization'

const REPORT_OPTIONS = [
  { value: 'pl', label: 'Profit & Loss' },
  { value: 'ar_aging', label: 'AR Aging' },
  { value: 'inventory', label: 'Inventory Summary' },
  { value: 'payroll_summary', label: 'Payroll Summary' },
  { value: 'sales_pipeline', label: 'Sales Pipeline' },
]

export default function AnalyticsModule() {
  const [tab, setTab] = useState('executive')
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null)
  const [selectedReport, setSelectedReport] = useState<ReportType>('pl')
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null)
  const [running, setRunning] = useState(false)
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.ok ? r.json() : null).then(d => setDashboard(d))
  }, [])

  const runReport = async () => {
    setRunning(true)
    const res = await fetch('/api/analytics/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: selectedReport, period }),
    })
    if (res.ok) setReportData((await res.json()).data)
    setRunning(false)
  }

  const fin = dashboard?.financials as Record<string, number> | undefined
  const sales = dashboard?.sales as Record<string, number> | undefined
  const inv = dashboard?.inventory as Record<string, number> | undefined

  // Build mock chart data from dashboard
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const revenueData = months.map((m, i) => ({
    month: m,
    revenue: Math.round(((fin?.revenue || 100000) * (0.7 + i * 0.08)) / 100),
    expenses: Math.round(((fin?.expenses || 70000) * (0.75 + i * 0.05)) / 100),
    profit: Math.round(((fin?.profit || 30000) * (0.6 + i * 0.1)) / 100),
  }))

  const pipelineData = [
    { stage: 'Prospect', value: (sales?.pipelineValue || 0) * 0.3 / 100, count: 12 },
    { stage: 'Qualified', value: (sales?.pipelineValue || 0) * 0.25 / 100, count: 8 },
    { stage: 'Proposal', value: (sales?.pipelineValue || 0) * 0.25 / 100, count: 5 },
    { stage: 'Negotiation', value: (sales?.pipelineValue || 0) * 0.2 / 100, count: 3 },
  ]

  const expenseBreakdown = [
    { name: 'Payroll', value: 45 },
    { name: 'Marketing', value: 18 },
    { name: 'Software', value: 12 },
    { name: 'Operations', value: 10 },
    { name: 'Other', value: 15 },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Analytics & BI"
        subtitle="Real-time dashboards, KPI tracking, and AI-powered business intelligence"
        actions={<Button variant="secondary" size="sm" icon={RefreshCw}>Refresh</Button>}
      />

      <Tabs tabs={[
        { key: 'executive', label: 'Executive Overview' },
        { key: 'finance', label: 'Finance' },
        { key: 'sales', label: 'Sales & CRM' },
        { key: 'operations', label: 'Operations' },
        { key: 'reports', label: 'Report Builder' },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {tab === 'executive' && (
          <>
            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Revenue MTD" value={fin ? `$${((fin.revenue||0)/100).toLocaleString()}` : '—'} sub={`${(fin?.revenueGrowth||0).toFixed(1)}% vs last month`} icon={DollarSign} color="#00a855" />
              <StatCard label="Net Profit" value={fin ? `$${((fin.profit||0)/100).toLocaleString()}` : '—'} sub={`${((fin?.margin||0)).toFixed(1)}% margin`} icon={TrendingUp} color="#2563eb" />
              <StatCard label="Pipeline" value={sales ? `$${((sales.weightedPipeline||0)/100).toLocaleString()}` : '—'} sub="weighted forecast" icon={BarChart3} color="#7c3aed" />
              <StatCard label="Inventory" value={inv ? `$${((inv.totalValue||0)/100).toLocaleString()}` : '—'} sub={`${inv?.totalSkus||0} SKUs`} icon={Package} color="#0891b2" />
            </div>

            {/* Revenue Trend */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Revenue vs Expenses — Last 6 Months</h3>
                <Button size="xs" variant="secondary" icon={Download}>Export</Button>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#00a855" radius={[3,3,0,0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="#f1f5f9" stroke="#e2e8f0" radius={[3,3,0,0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              {/* Expense Breakdown */}
              <Card>
                <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Expense Breakdown</h3>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie data={expenseBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                        {expenseBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {expenseBreakdown.map((e, i) => (
                      <div key={e.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                        <span className="text-xs text-gray-600">{e.name}</span>
                        <span className="ml-auto text-xs font-semibold text-gray-800">{e.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Sales Pipeline */}
              <Card>
                <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Sales Pipeline by Stage</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={pipelineData} layout="vertical">
                    <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="value" fill="#7c3aed" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </>
        )}

        {tab === 'finance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="AR Balance" value={fin ? `$${((fin.arBalance||0)/100).toLocaleString()}` : '—'} sub="outstanding invoices" color="#dc2626" />
              <StatCard label="AP Balance" value={fin ? `$${((fin.apBalance||0)/100).toLocaleString()}` : '—'} sub="bills to pay" color="#d97706" />
              <StatCard label="Net Working Capital" value={fin ? `$${(((fin.arBalance||0) - (fin.apBalance||0))/100).toLocaleString()}` : '—'} color="#2563eb" />
            </div>
            <Card>
              <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Profit Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00a855" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#00a855" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Area type="monotone" dataKey="profit" stroke="#00a855" fill="url(#profGrad)" strokeWidth={2} name="Net Profit" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {tab === 'reports' && (
          <Card>
            <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Report Builder</h3>
            <div className="flex items-end gap-3 mb-6">
              <Select label="Report Type" value={selectedReport} onChange={v => setSelectedReport(v as ReportType)} options={REPORT_OPTIONS} className="w-56" />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
                <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                  className="border border-black/[0.08] rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#0a0a0a]" />
              </div>
              <Button icon={Play} loading={running} onClick={runReport} variant="primary">Generate Report</Button>
            </div>

            {reportData ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-700">
                    {REPORT_OPTIONS.find(r => r.value === selectedReport)?.label} — {period}
                  </h4>
                  <Button size="xs" variant="secondary" icon={Download}>Download PDF</Button>
                </div>
                <pre className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 overflow-auto max-h-96">
                  {JSON.stringify(reportData, null, 2)}
                </pre>
              </div>
            ) : (
              <EmptyState icon={BarChart3} title="Select a report type and click Generate" description="Reports are generated from your live data and can be exported as PDF or CSV." />
            )}
          </Card>
        )}

        {(tab === 'sales' || tab === 'operations') && (
          <EmptyState icon={BarChart3} title="Module analytics coming soon" description="Detailed analytics for each module are being built. The executive overview pulls from all modules." />
        )}
      </div>
    </div>
  )
}
