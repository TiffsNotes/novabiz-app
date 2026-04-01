'use client'
import { useState, useEffect } from 'react'
import {
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Zap,
  RefreshCw, ChevronDown, ChevronRight, Clock, ArrowRight,
  Shield, DollarSign, Package, Users, ShoppingCart, BarChart3,
  AlertCircle, Target, Lightbulb, Activity
} from 'lucide-react'
import { PageHeader, Card, Badge, Button } from '@/components/ui'

// ─── TYPES ───────────────────────────────────────────────────
type Severity = 'CRITICAL' | 'WARNING' | 'WATCH' | 'POSITIVE'

interface NOVASignal {
  id: string
  severity: Severity
  category: string
  module: string
  title: string
  situation: string
  impact: string
  solution: string[]
  urgencyWindow: string
  evidence: Record<string, unknown>
  autoFixable: boolean
  autoFixAction?: string
  detectedAt: string
}

interface NOVAReport {
  businessName: string
  generatedAt: string
  overallHealth: 'CRITICAL' | 'AT_RISK' | 'STABLE' | 'HEALTHY' | 'THRIVING'
  healthScore: number
  executiveSummary: string
  criticalAlerts: NOVASignal[]
  warnings: NOVASignal[]
  watchItems: NOVASignal[]
  positiveSignals: NOVASignal[]
  topPriority: NOVASignal | null
  todaysFocus: string[]
  horizon30Days: string
  autoFixCount: number
}

// ─── SEVERITY CONFIG ─────────────────────────────────────────
const SEV_CONFIG: Record<Severity, {
  bg: string; border: string; text: string; icon: React.ElementType; label: string; dot: string
}> = {
  CRITICAL: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', icon: AlertTriangle, label: 'Critical', dot: '#dc2626' },
  WARNING:  { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', icon: AlertCircle,  label: 'Warning',  dot: '#d97706' },
  WATCH:    { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb', icon: Activity,     label: 'Watch',    dot: '#2563eb' },
  POSITIVE: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a', icon: CheckCircle,  label: 'Positive', dot: '#16a34a' },
}

const HEALTH_CONFIG = {
  CRITICAL: { color: '#dc2626', bg: '#fef2f2', label: 'Critical', desc: 'Immediate action required' },
  AT_RISK:  { color: '#d97706', bg: '#fffbeb', label: 'At Risk',  desc: 'Several issues need attention' },
  STABLE:   { color: '#2563eb', bg: '#eff6ff', label: 'Stable',   desc: 'Monitoring active risks' },
  HEALTHY:  { color: '#00a855', bg: '#f0fdf4', label: 'Healthy',  desc: 'Operating well' },
  THRIVING: { color: '#059669', bg: '#ecfdf5', label: 'Thriving', desc: 'Firing on all cylinders' },
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  AutoBooks: DollarSign, CashOracle: TrendingUp, SalesFlow: Target,
  PayrollAI: Users, SupplyChainAI: Package, GrowthEngine: BarChart3,
  ComplianceGuard: Shield, HR: Users, 'SupplyChain': Package,
}

// ─── SIGNAL CARD ─────────────────────────────────────────────
function SignalCard({ signal, defaultOpen = false }: { signal: NOVASignal; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [fixing, setFix] = useState(false)
  const sev = SEV_CONFIG[signal.severity]
  const Icon = sev.icon
  const ModuleIcon = MODULE_ICONS[signal.module] || Zap

  const fix = async () => {
    setFix(true)
    // Trigger auto-fix via CommandInbox
    await fetch('/api/intelligence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'auto_fix', signalId: signal.id }) }).catch(() => {})
    setTimeout(() => setFix(false), 2000)
  }

  return (
    <div className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md" style={{ borderColor: sev.border, background: '#fff' }}>
      {/* Header */}
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-start gap-3 p-4">
          {/* Severity indicator */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: sev.bg }}>
            <Icon size={15} style={{ color: sev.text }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: sev.text, background: sev.bg }}>
                {sev.label}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <ModuleIcon size={10} />{signal.module}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={10} />Act within {signal.urgencyWindow}
              </span>
              {signal.autoFixable && (
                <span className="text-xs font-medium text-[#007a3d] bg-[#e8f8f0] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Zap size={9} />NOVA can fix
                </span>
              )}
            </div>
            <div className="font-semibold text-gray-900 text-sm">{signal.title}</div>
            <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{signal.situation}</div>
          </div>

          <div className="flex-shrink-0 text-gray-400 mt-1">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t space-y-4" style={{ borderColor: sev.border + '80' }}>
          {/* Situation */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">What's happening</div>
            <p className="text-sm text-gray-700 leading-relaxed">{signal.situation}</p>
          </div>

          {/* Impact */}
          <div className="rounded-xl p-3" style={{ background: sev.bg }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: sev.text }}>Why it matters</div>
            <p className="text-sm leading-relaxed" style={{ color: sev.text }}>{signal.impact}</p>
          </div>

          {/* Solution */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Exactly what to do</div>
            <ol className="space-y-2">
              {signal.solution.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Auto-fix button */}
          {signal.autoFixable && signal.autoFixAction && (
            <div className="flex items-center gap-3 pt-1">
              <Button size="sm" variant="success" icon={Zap} loading={fixing} onClick={fix}>
                {fixing ? 'Adding to CommandInbox...' : `NOVA: ${signal.autoFixAction}`}
              </Button>
              <span className="text-xs text-gray-400">Will queue in CommandInbox for your approval</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── HEALTH GAUGE ────────────────────────────────────────────
function HealthGauge({ score, health }: { score: number; health: string }) {
  const config = HEALTH_CONFIG[health as keyof typeof HEALTH_CONFIG]
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="10"
            stroke={config.color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>{score}</span>
        </div>
      </div>
      <div>
        <div className="text-lg font-black" style={{ color: config.color, fontFamily: 'Cabinet Grotesk, sans-serif' }}>{config.label}</div>
        <div className="text-sm text-gray-500">{config.desc}</div>
      </div>
    </div>
  )
}

// ─── MAIN MODULE ─────────────────────────────────────────────
export default function NOVAIntelligenceModule() {
  const [report, setReport] = useState<NOVAReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | Severity>('all')

  const loadReport = async (fresh = false) => {
    if (fresh) setScanning(true)
    const res = await fetch(`/api/intelligence${fresh ? '?fresh=true' : ''}`)
    if (res.ok) {
      const data = await res.json()
      setReport(data.report as NOVAReport)
    }
    setLoading(false)
    setScanning(false)
  }

  useEffect(() => { loadReport() }, [])

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#0a0a0a] flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-black text-xl" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>N</span>
        </div>
        <div className="font-semibold text-gray-700">NOVA is scanning your business...</div>
        <div className="text-sm text-gray-400 mt-1">Checking all 8 modules simultaneously</div>
        <div className="flex gap-1 justify-center mt-4">
          {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-[#00a855] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </div>
    </div>
  )

  if (!report) return (
    <div className="p-6">
      <Card>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-3">No intelligence report available</div>
          <Button onClick={() => loadReport(true)} icon={RefreshCw}>Run First Scan</Button>
        </div>
      </Card>
    </div>
  )

  const allSignals = [...report.criticalAlerts, ...report.warnings, ...report.watchItems, ...report.positiveSignals]
  const displaySignals = activeTab === 'all' ? allSignals : allSignals.filter(s => s.severity === activeTab)

  const tabs: { key: 'all' | Severity; label: string; count: number; color?: string }[] = [
    { key: 'all', label: 'All', count: allSignals.length },
    { key: 'CRITICAL', label: 'Critical', count: report.criticalAlerts.length, color: '#dc2626' },
    { key: 'WARNING', label: 'Warnings', count: report.warnings.length, color: '#d97706' },
    { key: 'WATCH', label: 'Watch', count: report.watchItems.length, color: '#2563eb' },
    { key: 'POSITIVE', label: 'Positive', count: report.positiveSignals.length, color: '#00a855' },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="NOVA Intelligence"
        subtitle="Proactive monitoring across all 8 AI executives — problems detected before they become crises"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Last scan: {new Date(report.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={scanning} onClick={() => loadReport(true)}>
              Rescan
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto">
        {/* Health overview */}
        <div className="bg-[#0a0a0a] px-6 py-5">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-start gap-8">
              <HealthGauge score={report.healthScore} health={report.overallHealth} />

              <div className="flex-1">
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Executive Summary</div>
                <p className="text-white/80 text-sm leading-relaxed mb-4">{report.executiveSummary}</p>

                {/* Signal counts */}
                <div className="flex gap-4">
                  {[
                    { label: 'Critical', count: report.criticalAlerts.length, color: '#dc2626' },
                    { label: 'Warnings', count: report.warnings.length, color: '#d97706' },
                    { label: 'Watch', count: report.watchItems.length, color: '#2563eb' },
                    { label: 'Auto-fixable', count: report.autoFixCount, color: '#00a855' },
                  ].map(item => (
                    <div key={item.label} className="bg-white/5 rounded-xl px-3 py-2 text-center">
                      <div className="font-black text-xl" style={{ color: item.color, fontFamily: 'Cabinet Grotesk, sans-serif' }}>{item.count}</div>
                      <div className="text-white/40 text-xs">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today's Focus */}
              <div className="w-72 bg-white/5 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={14} className="text-[#00a855]" />
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Today's focus</span>
                </div>
                <ol className="space-y-2">
                  {report.todaysFocus.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/70 leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-[#00a855]/20 text-[#00a855] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      {item}
                    </li>
                  ))}
                </ol>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-white/30 font-medium mb-1">30-day outlook</div>
                  <p className="text-xs text-white/50 leading-relaxed">{report.horizon30Days}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top priority */}
        {report.topPriority && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-100">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-red-600" />
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Top priority right now</span>
              </div>
              <SignalCard signal={report.topPriority} defaultOpen={true} />
            </div>
          </div>
        )}

        {/* Tabs + signal list */}
        <div className="max-w-6xl mx-auto px-6 py-4">
          {/* Tab bar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-white text-gray-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Signal cards */}
          {displaySignals.length === 0 ? (
            <Card>
              <div className="py-10 text-center">
                <CheckCircle size={32} className="text-[#00a855] mx-auto mb-3" />
                <div className="font-semibold text-gray-700">No {activeTab !== 'all' ? activeTab.toLowerCase() : ''} signals</div>
                <p className="text-sm text-gray-400 mt-1">
                  {activeTab === 'CRITICAL' ? 'No critical issues detected.' : `No ${activeTab.toLowerCase()} signals at this time.`}
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {displaySignals.map((signal, idx) => (
                <SignalCard
                  key={signal.id || idx}
                  signal={signal}
                  defaultOpen={signal.severity === 'CRITICAL' && idx === 0 && activeTab !== 'all'}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
