'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Bell, RefreshCw, BookOpen, Users, Package, TrendingUp, Megaphone, UserCheck, DollarSign, Zap, Shield } from 'lucide-react'

const MODULE_ICONS: Record<string, any> = {
  autobooks: { icon: BookOpen, color: '#2563eb', label: 'AutoBooks' },
  payroll: { icon: UserCheck, color: '#059669', label: 'PayrollAI' },
  marketing: { icon: Megaphone, color: '#d97706', label: 'GrowthEngine' },
  crm: { icon: TrendingUp, color: '#7c3aed', label: 'SalesFlow' },
  inventory: { icon: Package, color: '#0891b2', label: 'SupplyChain' },
  orders: { icon: Package, color: '#0891b2', label: 'Orders' },
  forecast: { icon: DollarSign, color: '#00a855', label: 'CashOracle' },
  invoices: { icon: DollarSign, color: '#00a855', label: 'Finance' },
  compliance: { icon: Shield, color: '#dc2626', label: 'Compliance' },
  hr: { icon: Users, color: '#059669', label: 'HR' },
  projects: { icon: Zap, color: '#7c3aed', label: 'Projects' },
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', dot: '#DC2626' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', dot: '#D97706' },
  info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB', dot: '#2563EB' },
}

interface AgentAlert {
  id: string
  type: string
  title: string
  description: string
  severity: string
  module: string
  actionRequired: boolean
  dismissed: boolean
  data: any
  createdAt: string
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  return Math.floor(hrs / 24) + 'd ago'
}

export default function CommandInboxPage() {
  const [items, setItems] = useState<AgentAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [counts, setCounts] = useState({ total: 0, critical: 0, warning: 0, info: 0, actionRequired: 0 })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox')
      const data = await res.json()
      setItems(data.items || [])
      setCounts(data.counts || {})
    } catch (e) {
      console.error('Failed to load inbox:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function dismiss(id: string) {
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', itemId: id }),
    })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function clearAll() {
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_all' }),
    })
    load()
  }

  const filtered = filter === 'all' ? items
    : filter === 'action' ? items.filter(i => i.actionRequired)
    : items.filter(i => i.severity === filter)

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'system-ui, sans-serif', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={20} color="#111" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>CommandInbox</h1>
            {counts.total > 0 && (
              <span style={{ background: '#DC2626', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                {counts.total}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            All decisions from your AI executives — approve or dismiss in one place
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={clearAll} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
            Clear Info
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Action Required', value: counts.actionRequired, color: '#DC2626', bg: '#FEF2F2', filter: 'action' },
          { label: 'Critical', value: counts.critical, color: '#DC2626', bg: '#FEF2F2', filter: 'critical' },
          { label: 'Warnings', value: counts.warning, color: '#D97706', bg: '#FFFBEB', filter: 'warning' },
          { label: 'Info', value: counts.info, color: '#2563EB', bg: '#EFF6FF', filter: 'info' },
        ].map(stat => (
          <button key={stat.filter} onClick={() => setFilter(filter === stat.filter ? 'all' : stat.filter)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e5e7eb', background: filter === stat.filter ? stat.bg : 'white', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{stat.label}</div>
          </button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <CheckCircle size={40} color="#D1FAE5" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 4 }}>All clear!</div>
          <div style={{ fontSize: 13 }}>No pending items. Your AI executives are on top of things.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => {
            const severity = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.info
            const moduleInfo = MODULE_ICONS[item.module] || { icon: Bell, color: '#6b7280', label: item.module }
            const ModuleIcon = moduleInfo.icon

            return (
              <div key={item.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: '4px solid ' + severity.dot, borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: severity.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={16} color={severity.text} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{item.title}</span>
                    {item.actionRequired && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: severity.bg, color: severity.text }}>
                        ACTION REQUIRED
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{item.description}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ModuleIcon size={11} color={moduleInfo.color} />
                      <span style={{ fontSize: 11, color: moduleInfo.color, fontWeight: 500 }}>{moduleInfo.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(item.createdAt)}</span>
                  </div>
                </div>
                <button onClick={() => dismiss(item.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 12, color: '#6b7280', flexShrink: 0 }}>
                  Dismiss
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
