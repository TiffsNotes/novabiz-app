'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Users, Package,
  CheckSquare2, AlertTriangle, ArrowUpRight, RefreshCw,
  Briefcase, ShoppingCart, Clock, BarChart2
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// ─── TYPES ───────────────────────────────────────────────────

interface KPICard {
  label: string
  value: string
  change?: number
  changeLabel?: string
  icon: React.ElementType
  color: string
  href?: string
}

interface DashboardData {
  financials: { revenue: number; expenses: number; profit: number; margin: number; revenueGrowth: number; arBalance: number; apBalance: number }
  sales: { wonDeals: number; wonRevenue: number; pipelineValue: number; weightedPipeline: number; newContacts: number }
  inventory: { lowStock: number; outOfStock: number; totalValue: number; totalSkus: number }
  hr: { headcount: number; pendingLeave: number; pendingExpenses: number; payrollThisMonth: number }
  projects: { activeProjects: number; overBudgetProjects: number; billableHoursMtd: number }
  ecommerce: { ordersMtd: number; revenueMtd: number; newCustomers: number; aov: number }
  cash: { current: number; forecast30: number }
  inbox: { pending: number }
  savings: { mtd: number }
  period: string
}

// ─── HELPERS ─────────────────────────────────────────────────

const fmt = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
const fmtK = (cents: number) => cents >= 100000 ? `$${(cents / 100000).toFixed(1)}K` : fmt(cents)

// ─── MAIN ────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [brief, setBrief] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [intelligenceAlerts, setIntelligenceAlerts] = useState<Array<{ title: string; severity: string; urgencyWindow: string }>>([])

  const load = async () => {
    setRefreshing(true)
    try {
      const dashRes = await fetch('/api/dashboard')
      if (dashRes.ok) setData(await dashRes.json())
    } catch (e) { console.error('Dashboard fetch failed', e) }
    try {
      const briefRes = await fetch('/api/dashboard/brief')
      if (briefRes.ok) setBrief((await briefRes.json()).brief)
    } catch (e) { console.error('Brief fetch failed', e) }
    try {
      const intelRes = await fetch('/api/intelligence?quick=true')
      if (intelRes.ok) {
        const intel = await intelRes.json()
        setIntelligenceAlerts((intel.signals || []).slice(0, 3))
      }
    } catch (e) { console.error('Intel fetch failed', e) }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  if (loading || !data) return <DashboardSkeleton />

  const d = data!

  const kpis: KPICard[] = [
    {
      label: 'Revenue MTD',
      value: fmtK(d.financials.revenue),
      change: d.financials.revenueGrowth,
      changeLabel: 'vs last month',
      icon: DollarSign,
      color: '#00a855',
      href: '/dashboard/autobooks',
    },
    {
      label: 'Profit MTD',
      value: fmtK(d.financials.profit),
      change: d.financials.margin,
      changeLabel: 'margin',
      icon: TrendingUp,
      color: '#2563eb',
      href: '/dashboard/autobooks',
    },
    {
      label: 'Pipeline',
      value: fmtK(d.sales.weightedPipeline),
      change: d.sales.wonDeals,
      changeLabel: 'deals won this month',
      icon: BarChart2,
      color: '#7c3aed',
      href: '/dashboard/crm',
    },
    {
      label: 'Cash Position',
      value: fmtK(d.cash.current),
      change: d.cash.forecast30 ? ((d.cash.forecast30 - d.cash.current) / d.cash.current) * 100 : 0,
      changeLabel: '30-day forecast',
      icon: TrendingUp,
      color: '#0891b2',
      href: '/dashboard/forecasting',
    },
    {
      label: 'eComm Revenue',
      value: fmtK(d.ecommerce.revenueMtd),
      change: d.ecommerce.ordersMtd,
      changeLabel: 'orders this month',
      icon: ShoppingCart,
      color: '#d97706',
      href: '/dashboard/ecommerce',
    },
    {
      label: 'Headcount',
      value: String(d.hr.headcount),
      change: d.hr.pendingLeave,
      changeLabel: 'pending leave requests',
      icon: Users,
      color: '#059669',
      href: '/dashboard/hr',
    },
    {
      label: 'Inventory Value',
      value: fmtK(d.inventory.totalValue),
      change: d.inventory.lowStock,
      changeLabel: 'low stock SKUs',
      icon: Package,
      color: '#dc2626',
      href: '/dashboard/inventory',
    },
    {
      label: 'Active Projects',
      value: String(d.projects.activeProjects),
      change: d.projects.billableHoursMtd,
      changeLabel: 'billable hours MTD',
      icon: Briefcase,
      color: '#7c3aed',
      href: '/dashboard/projects',
    },
  ]

  // Mock sparkline data
  const revenueSparkline = Array.from({ length: 14 }, (_, i) => ({
    day: i,
    value: Math.round(d.financials.revenue * (0.5 + Math.random() * 0.8) / 14 / 100),
  }))

  const savingsSparkline = Array.from({ length: 30 }, (_, i) => ({
    day: i,
    value: Math.round((d.savings.mtd / 30) * (0.7 + Math.random()) / 100),
  }))

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.03em' }}>
            Good morning 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{d.period} · Here's your business snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          {d.inbox.pending > 0 && (
            <a
              href="/dashboard/inbox"
              className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle size={14} />
              {d.inbox.pending} pending approval{d.inbox.pending !== 1 ? 's' : ''}
            </a>
          )}
          <button
            onClick={load}
            disabled={refreshing}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* NOVA Intelligence alerts */}
      {intelligenceAlerts.length > 0 && (
        <div className="space-y-1.5">
          {intelligenceAlerts.map((alert, i) => (
            <a key={i} href="/dashboard/intelligence"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                alert.severity === 'CRITICAL'
                  ? 'bg-red-50 border-red-200 hover:bg-red-100'
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
              }`}>
              <AlertTriangle size={13} className={alert.severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'} />
              <span className={`font-medium ${alert.severity === 'CRITICAL' ? 'text-red-700' : 'text-amber-700'}`}>
                {alert.title}
              </span>
              <span className={`text-xs ml-auto ${alert.severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'}`}>
                Act within {alert.urgencyWindow} →
              </span>
            </a>
          ))}
          {intelligenceAlerts.length > 0 && (
            <a href="/dashboard/intelligence" className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 px-1">
              <span>View full NOVA Intelligence report →</span>
            </a>
          )}
        </div>
      )}

      {/* AI Brief */}
      {brief && (
        <div className="bg-[#0a0a0a] rounded-xl p-4 border border-black/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-[#00a855] flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">NOVA CoS · Daily Brief</span>
            <span className="ml-auto text-white/30 text-xs">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{brief}</div>
        </div>
      )}

      {/* Savings Banner */}
      <div className="bg-[#e8f8f0] border border-[#00a855]/20 rounded-xl px-5 py-3 flex items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-[#007a3d] uppercase tracking-wider">Savings documented this month</div>
          <div className="text-2xl font-black text-[#00a855]" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
            {fmt(d.savings.mtd)}
          </div>
        </div>
        <div className="w-px h-10 bg-[#00a855]/20" />
        <div className="text-sm text-[#007a3d]">
          vs. <span className="font-bold">$4,200/mo</span> you were paying before · {((d.savings.mtd / 49900) * 100).toFixed(0)}× ROI
        </div>
        <div className="ml-auto w-32 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={savingsSparkline}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a855" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00a855" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#00a855" fill="url(#sg)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <a key={kpi.label} href={kpi.href} className="bg-white rounded-xl border border-black/[0.07] p-4 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">{kpi.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: kpi.color + '15' }}>
                <kpi.icon size={14} style={{ color: kpi.color }} />
              </div>
            </div>
            <div className="text-xl font-black text-gray-900 mb-1" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
              {kpi.value}
            </div>
            {kpi.change !== undefined && (
              <div className="flex items-center gap-1">
                {kpi.change > 0
                  ? <TrendingUp size={11} className="text-[#00a855]" />
                  : kpi.change < 0
                    ? <TrendingDown size={11} className="text-red-500" />
                    : null
                }
                <span className={`text-xs ${kpi.change > 0 ? 'text-[#00a855]' : kpi.change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {kpi.change > 0 ? '+' : ''}{typeof kpi.change === 'number' && Math.abs(kpi.change) < 200 && kpi.changeLabel?.includes('%') ? kpi.change.toFixed(1) + '%' : kpi.change.toFixed(kpi.changeLabel?.includes('month') ? 0 : 1)}
                </span>
                <span className="text-xs text-gray-400">{kpi.changeLabel}</span>
              </div>
            )}
            <ArrowUpRight size={12} className="absolute top-3 right-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-black/[0.07] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Revenue vs Expenses</h3>
            <span className="text-xs text-gray-400">Last 14 days</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={revenueSparkline}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a855" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00a855" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#999' }} />
              <YAxis tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(v) => `$${v}k`} />
              <Tooltip formatter={(v: number) => [`$${v}k`, 'Revenue']} />
              <Area type="monotone" dataKey="value" stroke="#00a855" fill="url(#rev)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-black/[0.07] p-5">
          <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Create invoice', href: '/dashboard/invoices/new', color: '#00a855' },
              { label: 'Add expense', href: '/dashboard/expenses/new', color: '#2563eb' },
              { label: 'New deal', href: '/dashboard/crm/deals/new', color: '#7c3aed' },
              { label: 'Add timesheet', href: '/dashboard/timesheets/new', color: '#d97706' },
              { label: 'Run payroll', href: '/dashboard/payroll', color: '#dc2626' },
              { label: 'View reports', href: '/dashboard/analytics', color: '#0891b2' },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 group transition-colors"
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: action.color }} />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{action.label}</span>
                <ArrowUpRight size={12} className="ml-auto text-gray-300 group-hover:text-gray-500" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      {(d.inventory.outOfStock > 0 || d.inventory.lowStock > 0 || d.hr.pendingLeave > 0) && (
        <div className="bg-white rounded-xl border border-black/[0.07] p-4">
          <h3 className="font-bold text-gray-900 mb-3 text-sm" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Needs attention</h3>
          <div className="flex flex-wrap gap-2">
            {d.inventory.outOfStock > 0 && (
              <a href="/dashboard/inventory" className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100">
                <AlertTriangle size={12} />
                {d.inventory.outOfStock} SKUs out of stock
              </a>
            )}
            {d.inventory.lowStock > 0 && (
              <a href="/dashboard/inventory" className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-100">
                <Package size={12} />
                {d.inventory.lowStock} SKUs low on stock
              </a>
            )}
            {d.hr.pendingLeave > 0 && (
              <a href="/dashboard/hr" className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100">
                <Clock size={12} />
                {d.hr.pendingLeave} leave requests pending
              </a>
            )}
            {d.financials.arBalance > 0 && (
              <a href="/dashboard/invoices" className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-100">
                <DollarSign size={12} />
                {fmtK(d.financials.arBalance)} in unpaid invoices
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="h-24 bg-gray-100 rounded-xl" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  )
}
