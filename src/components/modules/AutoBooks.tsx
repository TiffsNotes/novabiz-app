'use client'
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, RefreshCw, CheckCircle, AlertCircle, Download, Filter, Play } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, Money, EmptyState } from '@/components/ui'

const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

type Transaction = {
  id: string; date: string; description: string; merchantName?: string
  amount: number; category?: string; categoryType?: string
  confidence?: number; reviewed: boolean; pending: boolean
}
type Summary = { uncategorized: number; mtdRevenue: number; mtdExpenses: number; mtdProfit: number }
type PLReport = { revenue: { total: number; byCategory: { name: string; amount: number }[] }; expenses: { total: number; byCategory: { name: string; amount: number }[] }; netProfit: number; netMargin: number; period: string }

export default function AutoBooksModule() {
  const [tab, setTab] = useState('transactions')
  const [txs, setTxs] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pl, setPL] = useState<PLReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [txRes, sumRes, plRes] = await Promise.all([
      fetch(`/api/autobooks?view=transactions&page=${page}&limit=50`),
      fetch('/api/autobooks?view=summary'),
      fetch('/api/autobooks?view=pl'),
    ])
    if (txRes.ok) { const d = await txRes.json(); setTxs(d.transactions); setTotal(d.total) }
    if (sumRes.ok) setSummary(await sumRes.json())
    if (plRes.ok) { const d = await plRes.json(); setPL(d.report) }
    setLoading(false)
  }, [page])

  useEffect(() => { loadData() }, [loadData])

  const runAutoBooks = async () => {
    setRunning(true)
    await fetch('/api/autobooks', { method: 'POST' })
    await loadData()
    setRunning(false)
  }

  const catBadge = (type?: string) => {
    if (type === 'INCOME') return <Badge variant="green">Income</Badge>
    if (type === 'EXPENSE') return <Badge variant="red">Expense</Badge>
    if (type === 'TRANSFER') return <Badge variant="blue">Transfer</Badge>
    return <Badge variant="gray">Uncategorized</Badge>
  }

  const plChartData = pl ? [
    ...pl.revenue.byCategory.slice(0, 5).map(c => ({ name: c.name, revenue: c.amount / 100, expenses: 0 })),
    ...pl.expenses.byCategory.slice(0, 5).map(c => ({ name: c.name, revenue: 0, expenses: c.amount / 100 })),
  ] : []

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="AutoBooks"
        subtitle="AI bookkeeper — every transaction categorized, every report generated automatically"
        actions={
          <Button icon={running ? undefined : Play} loading={running} onClick={runAutoBooks} variant="success" size="sm">
            {running ? 'Running...' : 'Run AutoBooks'}
          </Button>
        }
      />

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
          <StatCard label="Revenue MTD" value={`$${((summary.mtdRevenue) / 100).toLocaleString()}`} icon={BookOpen} color="#00a855" />
          <StatCard label="Expenses MTD" value={`$${((summary.mtdExpenses) / 100).toLocaleString()}`} icon={BookOpen} color="#dc2626" />
          <StatCard label="Profit MTD" value={`$${((summary.mtdProfit) / 100).toLocaleString()}`} sub={summary.mtdRevenue > 0 ? `${((summary.mtdProfit / summary.mtdRevenue) * 100).toFixed(1)}% margin` : ''} icon={BookOpen} color="#2563eb" />
          <StatCard label="Needs Review" value={String(summary.uncategorized)} sub="uncategorized transactions" icon={AlertCircle} color="#d97706" />
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'transactions', label: 'Transactions', count: total },
          { key: 'pl', label: 'P&L Report' },
          { key: 'categories', label: 'Categories' },
        ]}
        active={tab} onChange={setTab}
      />

      <div className="flex-1 overflow-auto p-4">
        {tab === 'transactions' && (
          <Card padding={false}>
            <Table<Transaction>
              columns={[
                { key: 'date', header: 'Date', render: r => <span className="text-gray-500 text-xs">{fmtDate(r.date)}</span> },
                { key: 'description', header: 'Description', render: r => (
                  <div>
                    <div className="font-medium text-gray-800">{r.merchantName || r.description}</div>
                    {r.merchantName && <div className="text-xs text-gray-400 truncate max-w-xs">{r.description}</div>}
                  </div>
                )},
                { key: 'category', header: 'Category', render: r => (
                  <div className="flex items-center gap-2">
                    {catBadge(r.categoryType)}
                    {r.category && <span className="text-xs text-gray-600">{r.category}</span>}
                    {r.confidence && r.confidence < 0.9 && <span className="text-xs text-amber-500">{Math.round(r.confidence * 100)}%</span>}
                  </div>
                )},
                { key: 'amount', header: 'Amount', render: r => (
                  <span className={`font-semibold tabular-nums ${r.amount > 0 ? 'text-[#00a855]' : 'text-gray-700'}`}>
                    {r.amount > 0 ? '+' : ''}${(Math.abs(r.amount) / 100).toLocaleString()}
                  </span>
                ), className: 'text-right' },
                { key: 'reviewed', header: 'Status', render: r => r.reviewed
                  ? <Badge variant="green">Reviewed</Badge>
                  : r.pending ? <Badge variant="yellow">Pending</Badge>
                  : <Badge variant="gray">Auto-categorized</Badge>
                },
              ]}
              data={txs}
              emptyMessage={loading ? 'Loading transactions...' : 'No transactions yet. Connect your bank to get started.'}
            />
            {total > 50 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.07]">
                <span className="text-xs text-gray-400">Showing {Math.min(50, total)} of {total}</span>
                <div className="flex gap-2">
                  <Button size="xs" variant="secondary" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>Previous</Button>
                  <Button size="xs" variant="secondary" onClick={() => setPage(p => p+1)} disabled={page * 50 >= total}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {tab === 'pl' && pl && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Revenue" value={`$${(pl.revenue.total/100).toLocaleString()}`} color="#00a855" />
              <StatCard label="Total Expenses" value={`$${(pl.expenses.total/100).toLocaleString()}`} color="#dc2626" />
              <StatCard label="Net Profit" value={`$${(pl.netProfit/100).toLocaleString()}`} sub={`${(pl.netMargin * 100).toFixed(1)}% margin`} color="#2563eb" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <h3 className="font-bold text-gray-900 mb-3 text-sm">Revenue by Category</h3>
                <div className="space-y-2">
                  {pl.revenue.byCategory.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{c.name}</span>
                      <span className="font-semibold text-[#00a855] text-sm tabular-nums">${(c.amount/100).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <h3 className="font-bold text-gray-900 mb-3 text-sm">Expenses by Category</h3>
                <div className="space-y-2">
                  {pl.expenses.byCategory.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{c.name}</span>
                      <span className="font-semibold text-red-600 text-sm tabular-nums">${(c.amount/100).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {plChartData.length > 0 && (
              <Card>
                <h3 className="font-bold text-gray-900 mb-4 text-sm">Top Categories Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={plChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="#00a855" radius={[0,3,3,0]} />
                    <Bar dataKey="expenses" fill="#dc2626" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        )}

        {tab === 'categories' && (
          <Card>
            <EmptyState icon={BookOpen} title="Chart of Accounts" description="Your categories are auto-configured based on your industry. Customize them here." />
          </Card>
        )}
      </div>
    </div>
  )
}
