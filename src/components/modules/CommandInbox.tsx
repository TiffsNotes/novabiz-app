'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle, XCircle, ChevronRight, Clock, AlertTriangle,
  DollarSign, Zap, BookOpen, Users, Package, TrendingUp,
  Megaphone, UserCheck, Filter, RefreshCw
} from 'lucide-react'

const MODULE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  AUTOBOOKS:     { label: 'AutoBooks',     icon: BookOpen,   color: '#2563eb' },
  PAYROLL:       { label: 'PayrollAI',     icon: UserCheck,  color: '#059669' },
  GROWTH:        { label: 'GrowthEngine',  icon: Megaphone,  color: '#d97706' },
  SALES:         { label: 'SalesFlow',     icon: TrendingUp, color: '#7c3aed' },
  SUPPLY_CHAIN:  { label: 'SupplyChainAI', icon: Package,    color: '#0891b2' },
  CASH_ORACLE:   { label: 'CashOracle',    icon: DollarSign, color: '#00a855' },
  COMPLIANCE:    { label: 'ComplianceGuard',icon: Zap,       color: '#dc2626' },
  CRM:           { label: 'CRM',           icon: Users,      color: '#7c3aed' },
  HR:            { label: 'HR',            icon: Users,      color: '#059669' },
}

const URGENCY_META = {
  LOW:      { label: 'Low',      color: '#6b7280', bg: '#f9fafb' },
  NORMAL:   { label: 'Normal',   color: '#2563eb', bg: '#eff6ff' },
  HIGH:     { label: 'High',     color: '#d97706', bg: '#fffbeb' },
  CRITICAL: { label: 'Critical', color: '#dc2626', bg: '#fef2f2' },
}

interface InboxItem {
  id: string
  title: string
  description?: string
  module: string
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  amount?: number
  dueAt?: string
  createdAt: string
  action: {
    actionType: string
    payload: Record<string, unknown>
    aiReasoning?: string
    confidence?: number
  }
}

const fmt = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function CommandInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InboxItem | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [processing, setProcessing] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/inbox')
    if (res.ok) {
      const data = await res.json()
      setItems(data.items)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const resolve = async (itemId: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessing(itemId)
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, itemId, reason }),
    })
    setItems(prev => prev.filter(i => i.id !== itemId))
    if (selected?.id === itemId) setSelected(null)
    setProcessing(null)
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.module === filter)
  const modules = [...new Set(items.map(i => i.module))]

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-[400px] border-r border-black/[0.07] flex flex-col bg-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.07]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
              CommandInbox
            </h1>
            <div className="flex items-center gap-1.5">
              {items.length > 0 && (
                <span className="bg-[#00a855] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              )}
              <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">Actions that need your approval before NovaBiz executes them.</p>

          {/* Module filters */}
          <div className="flex gap-1.5 mt-3 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All ({items.length})
            </button>
            {modules.map(m => {
              const meta = MODULE_META[m]
              return (
                <button
                  key={m}
                  onClick={() => setFilter(m)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filter === m ? 'text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                  style={filter === m ? { background: meta?.color } : { background: '#f3f4f6' }}
                >
                  {meta?.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04]">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-50 rounded w-1/2" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle size={32} className="text-[#00a855] mx-auto mb-3" />
              <div className="font-semibold text-gray-700">All caught up!</div>
              <p className="text-gray-400 text-sm mt-1">No pending approvals</p>
            </div>
          ) : (
            filtered.map(item => {
              const meta = MODULE_META[item.module]
              const urgMeta = URGENCY_META[item.urgency]
              const isSelected = selected?.id === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-gray-50' : 'hover:bg-gray-50/60'}`}
                >
                  <div className="flex items-start gap-3">
                    {meta && (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: meta.color + '15' }}>
                        <meta.icon size={13} style={{ color: meta.color }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold" style={{ color: meta?.color }}>{meta?.label}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ color: urgMeta.color, background: urgMeta.bg }}>
                          {urgMeta.label}
                        </span>
                        {item.dueAt && new Date(item.dueAt) < new Date() && (
                          <AlertTriangle size={11} className="text-red-500" />
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-800 truncate">{item.title}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">{item.description}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {item.amount && (
                          <span className="text-xs font-semibold text-gray-700">{fmt(item.amount)}</span>
                        )}
                        <span className="text-xs text-gray-400">{timeAgo(item.createdAt)}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel - item detail */}
      {selected ? (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl">
            {/* Module badge */}
            {MODULE_META[selected.module] && (
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: MODULE_META[selected.module].color + '15' }}>
                  {(() => { const Icon = MODULE_META[selected.module].icon; return <Icon size={16} style={{ color: MODULE_META[selected.module].color }} /> })()}
                </div>
                <span className="font-semibold text-sm" style={{ color: MODULE_META[selected.module].color }}>
                  {MODULE_META[selected.module].label}
                </span>
                <span className="text-gray-400 text-xs">{timeAgo(selected.createdAt)}</span>
              </div>
            )}

            <h2 className="text-xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
              {selected.title}
            </h2>

            {selected.description && (
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{selected.description}</p>
            )}

            {/* Amount */}
            {selected.amount && (
              <div className="bg-gray-50 border border-black/[0.07] rounded-xl p-4 mb-4">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Amount</div>
                <div className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                  {fmt(selected.amount)}
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {selected.action.aiReasoning && (
              <div className="bg-[#f0fdf4] border border-[#00a855]/20 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-[#00a855] flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">N</span>
                  </div>
                  <span className="text-xs font-semibold text-[#007a3d]">AI Reasoning</span>
                  {selected.action.confidence && (
                    <span className="text-xs text-[#007a3d] ml-auto">{Math.round(selected.action.confidence * 100)}% confidence</span>
                  )}
                </div>
                <p className="text-sm text-[#007a3d] leading-relaxed">{selected.action.aiReasoning}</p>
              </div>
            )}

            {/* Payload */}
            <div className="bg-gray-50 border border-black/[0.07] rounded-xl p-4 mb-6">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Action details</div>
              <div className="text-xs font-mono text-gray-600 overflow-auto">
                <pre>{JSON.stringify(selected.action.payload, null, 2)}</pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => resolve(selected.id, 'approve')}
                disabled={processing === selected.id}
                className="flex-1 flex items-center justify-center gap-2 bg-[#00a855] text-white py-3 rounded-xl font-semibold transition-all hover:bg-[#009949] disabled:opacity-50"
              >
                <CheckCircle size={16} />
                {processing === selected.id ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => resolve(selected.id, 'reject')}
                disabled={processing === selected.id}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 py-3 rounded-xl font-semibold hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle size={16} />
                Reject
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">
              This action will be logged with your decision for the full audit trail.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-12">
          <div>
            <CheckSquare size={40} className="text-gray-200 mx-auto mb-4" />
            <div className="text-gray-400 font-medium">Select an item to review</div>
            <p className="text-gray-300 text-sm mt-1">Click any pending action to see details and approve or reject</p>
          </div>
        </div>
      )}
    </div>
  )
}
