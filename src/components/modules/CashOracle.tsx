'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, AlertTriangle, DollarSign, Calendar, RefreshCw, Shield } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { PageHeader, Card, StatCard, Badge, Tabs, Button, EmptyState } from '@/components/ui'

type ForecastPoint = { date: string; balance: number; inflows: number; outflows: number; confidenceLow: number; confidenceHigh: number }
type ForecastSummary = { currentBalance: number; balanceIn30Days: number; balanceIn90Days: number; runwayDays: number | null; alertLevel: 'ok' | 'warning' | 'critical'; taxSetAside: number; points: ForecastPoint[] }

const fmt = (c: number) => `$${Math.abs(c / 100).toLocaleString()}`
const fmtShort = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-black/[0.07] rounded-xl p-3 shadow-lg text-xs">
      <div className="font-semibold text-gray-700 mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function CashOracleModule() {
  const [tab, setTab] = useState('forecast')
  const [forecast, setForecast] = useState<ForecastSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [scenario, setScenario] = useState<'base' | 'optimistic' | 'pessimistic'>('base')

  const loadForecast = async () => {
    setLoading(true)
    const res = await fetch('/api/forecast')
    if (res.ok) setForecast(await res.json())
    setLoading(false)
  }

  const regen = async () => {
    setRegenerating(true)
    const res = await fetch('/api/forecast', { method: 'POST' })
    if (res.ok) setForecast(await res.json())
    setRegenerating(false)
  }

  useEffect(() => { loadForecast() }, [])

  const chartData = forecast?.points?.slice(0, 90).filter((_, i) => i % 3 === 0).map(p => ({
    date: fmtShort(p.date),
    balance: p.balance / 100,
    low: p.confidenceLow / 100,
    high: p.confidenceHigh / 100,
    inflows: p.inflows / 100,
    outflows: p.outflows / 100,
  })) || []

  const alertColor = forecast?.alertLevel === 'critical' ? '#dc2626' : forecast?.alertLevel === 'warning' ? '#d97706' : '#00a855'

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="CashOracle"
        subtitle="90-day rolling cash flow forecast with scenario modeling and tax set-aside automation"
        actions={
          <Button icon={RefreshCw} size="sm" variant="secondary" loading={regenerating} onClick={regen}>
            Regenerate
          </Button>
        }
      />

      {forecast && (
        <div className="grid grid-cols-5 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
          <StatCard label="Current Balance" value={fmt(forecast.currentBalance)} color="#2563eb" />
          <StatCard label="Balance in 30 Days" value={fmt(forecast.balanceIn30Days)} sub={forecast.balanceIn30Days < forecast.currentBalance ? '↓ Declining' : '↑ Growing'} color={forecast.balanceIn30Days < 0 ? '#dc2626' : '#00a855'} />
          <StatCard label="Balance in 90 Days" value={fmt(forecast.balanceIn90Days)} color={forecast.balanceIn90Days < 0 ? '#dc2626' : '#0891b2'} />
          <StatCard label="Runway" value={forecast.runwayDays ? `${forecast.runwayDays} days` : 'Healthy'} sub={forecast.runwayDays ? 'until cash runs out' : 'No runway concern'} color={forecast.runwayDays && forecast.runwayDays < 90 ? '#dc2626' : '#00a855'} />
          <StatCard label="Tax Reserve (Q)" value={fmt(forecast.taxSetAside)} sub="recommended set-aside" color="#7c3aed" icon={Shield} />
        </div>
      )}

      {/* Alert banner */}
      {forecast?.alertLevel !== 'ok' && (
        <div className={`px-4 py-2.5 border-b flex items-center gap-3 ${forecast?.alertLevel === 'critical' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
          <AlertTriangle size={14} style={{ color: alertColor }} className="flex-shrink-0" />
          <span className="text-sm" style={{ color: alertColor }}>
            {forecast?.alertLevel === 'critical'
              ? `⚠ Cash position drops below zero in ${forecast.runwayDays} days. Immediate action recommended.`
              : `Cash balance declining — projected to drop 20%+ in next 30 days. Review upcoming expenses.`
            }
          </span>
        </div>
      )}

      <Tabs tabs={[
        { key: 'forecast', label: '90-Day Forecast' },
        { key: 'cashflow', label: 'Cash Flow' },
        { key: 'scenarios', label: 'Scenarios' },
        { key: 'tax', label: 'Tax Set-Aside' },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {tab === 'forecast' && (
          <>
            {loading ? (
              <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            ) : chartData.length > 0 ? (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>90-Day Cash Position</h3>
                  <div className="flex gap-2">
                    {(['base', 'optimistic', 'pessimistic'] as const).map(s => (
                      <button key={s} onClick={() => setScenario(s)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-colors ${scenario === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.05} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="high" fill="url(#confGrad)" stroke="none" name="High" />
                    <Area type="monotone" dataKey="balance" stroke="#2563eb" fill="url(#balGrad)" strokeWidth={2} dot={false} name="Projected Balance" />
                    <Area type="monotone" dataKey="low" fill="white" stroke="none" name="Low" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-blue-600 inline-block" />Projected balance</span>
                  <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-blue-200 inline-block" />Confidence range</span>
                  <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-red-400 border-dashed border inline-block" />Zero</span>
                </div>
              </Card>
            ) : (
              <EmptyState icon={TrendingUp} title="No forecast data yet" description="Connect your bank account to generate a 90-day cash flow forecast." action={<Button size="sm">Connect Bank</Button>} />
            )}

            {/* Key dates */}
            {forecast && (
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Next Large Outflow</div>
                  <div className="font-bold text-gray-900">Payroll</div>
                  <div className="text-sm text-gray-500 mt-1">Expected in ~14 days</div>
                  <div className="font-semibold text-red-600 mt-1">{fmt(forecast.currentBalance * 0.15)}</div>
                </Card>
                <Card>
                  <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Recommended Action</div>
                  {forecast.alertLevel === 'ok' ? (
                    <>
                      <div className="font-bold text-[#00a855]">Cash flow healthy ✓</div>
                      <div className="text-sm text-gray-500 mt-1">No immediate action needed</div>
                    </>
                  ) : (
                    <>
                      <div className="font-bold text-red-600">Review expenses</div>
                      <div className="text-sm text-gray-500 mt-1">Consider deferring non-essential spend</div>
                    </>
                  )}
                </Card>
                <Card>
                  <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Quarterly Tax Due</div>
                  <div className="font-bold text-gray-900">Set aside now</div>
                  <div className="font-semibold text-purple-600 mt-1">{fmt(forecast.taxSetAside)}</div>
                  <div className="text-xs text-gray-400 mt-1">Based on projected income</div>
                </Card>
              </div>
            )}
          </>
        )}

        {tab === 'cashflow' && chartData.length > 0 && (
          <Card>
            <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Daily Cash Flows</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="inflows" stroke="#00a855" fill="#e8f8f0" strokeWidth={1.5} name="Inflows" />
                <Area type="monotone" dataKey="outflows" stroke="#dc2626" fill="#fef2f2" strokeWidth={1.5} name="Outflows" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}

        {(tab === 'scenarios' || tab === 'tax') && (
          <EmptyState icon={TrendingUp} title={tab === 'scenarios' ? 'Scenario Modeling' : 'Tax Set-Aside Automation'} description={tab === 'scenarios' ? 'Model different revenue and expense scenarios to prepare for uncertainty.' : 'Automatically set aside the right amount for quarterly taxes based on your projected income.'} action={<Button size="sm" variant="secondary">Configure</Button>} />
        )}
      </div>
    </div>
  )
}
