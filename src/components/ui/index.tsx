'use client'
import { ReactNode, useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

// ─── BUTTON ──────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type BtnSize = 'xs' | 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
  icon?: React.ElementType
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed'
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-[#0a0a0a] text-white hover:bg-[#00a855]',
    secondary: 'bg-white text-gray-700 border border-black/[0.08] hover:bg-gray-50',
    ghost: 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-[#00a855] text-white hover:bg-[#009949]',
  }
  const sizes: Record<BtnSize, string> = {
    xs: 'text-xs px-2.5 py-1.5',
    sm: 'text-sm px-3 py-2',
    md: 'text-sm px-4 py-2.5',
  }
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : Icon && <Icon size={size === 'xs' ? 12 : 14} />}
      {children}
    </button>
  )
}

// ─── BADGE ───────────────────────────────────────────────────
type BadgeVariant = 'default' | 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray'

export function Badge({ variant = 'default', children }: { variant?: BadgeVariant; children: ReactNode }) {
  const styles: Record<BadgeVariant, string> = {
    default: 'bg-gray-100 text-gray-700',
    green: 'bg-[#e8f8f0] text-[#007a3d]',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-50 text-gray-500',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${styles[variant]}`}>{children}</span>
}

// ─── CARD ────────────────────────────────────────────────────
export function Card({ children, className = '', padding = true }: { children: ReactNode; className?: string; padding?: boolean }) {
  return (
    <div className={`bg-white border border-black/[0.07] rounded-xl shadow-sm ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ─── STAT CARD ───────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color = '#0a0a0a' }: {
  label: string; value: string; sub?: string; icon?: React.ElementType; color?: string
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '15' }}>
            <Icon size={14} style={{ color }} />
          </div>
        )}
      </div>
      <div className="text-2xl font-black text-gray-900 leading-none mb-1" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </Card>
  )
}

// ─── TABLE ───────────────────────────────────────────────────
interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

export function Table<T extends Record<string, unknown>>({ columns, data, onRowClick, emptyMessage = 'No data' }: {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[0.07]">
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.04]">
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">{emptyMessage}</td></tr>
          ) : data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
            >
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className || ''}`}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── MODAL ───────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.07]">
          <h2 className="font-bold text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.02em' }}>{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ─── PAGE HEADER ─────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-6 py-5 border-b border-black/[0.07] bg-white">
      <div>
        <h1 className="text-xl font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={22} className="text-gray-400" />
      </div>
      <div className="font-semibold text-gray-700 mb-1">{title}</div>
      {description && <p className="text-sm text-gray-400 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ─── TAB BAR ─────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex border-b border-black/[0.07] bg-white px-4 gap-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            active === tab.key ? 'border-[#0a0a0a] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${active === tab.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── MONEY ───────────────────────────────────────────────────
export function Money({ cents, colored }: { cents: number; colored?: boolean }) {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(cents) / 100)
  const neg = cents < 0
  const cls = colored ? (neg ? 'text-red-600' : 'text-[#00a855]') : ''
  return <span className={`tabular-nums ${cls}`}>{neg ? '-' : ''}{formatted}</span>
}

// ─── SELECT ──────────────────────────────────────────────────
export function Select({ label, value, onChange, options, className = '' }: {
  label?: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-black/[0.08] rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#0a0a0a] focus:border-transparent"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ─── INPUT ───────────────────────────────────────────────────
export function Input({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <input
        {...props}
        className={`w-full text-sm border rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#0a0a0a] focus:border-transparent ${
          error ? 'border-red-400' : 'border-black/[0.08]'
        } ${props.className || ''}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── PROGRESS BAR ────────────────────────────────────────────
export function ProgressBar({ value, max, color = '#00a855', label }: { value: number; max: number; color?: string; label?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      {label && <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{label}</span><span>{pct}%</span></div>}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
