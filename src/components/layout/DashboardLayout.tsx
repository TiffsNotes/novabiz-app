'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import {
  LayoutDashboard, BookOpen, Users, Package, ShoppingCart,
  TrendingUp, DollarSign, CheckSquare, Settings, ChevronRight,
  Bell, Search, Briefcase, Clock, BarChart3, Zap, Menu, X,
  Building2, CreditCard, FileText, Truck, UserCheck, Megaphone,
  Brain
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: null },
      { href: '/dashboard/intelligence', icon: Brain, label: 'NOVA Intelligence', badge: null },
      { href: '/dashboard/inbox', icon: CheckSquare, label: 'CommandInbox', badge: 'inbox' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/autobooks', icon: BookOpen, label: 'AutoBooks', badge: null },
      { href: '/dashboard/invoices', icon: FileText, label: 'Invoices & Bills', badge: null },
      { href: '/dashboard/forecasting', icon: TrendingUp, label: 'CashOracle', badge: null },
      { href: '/dashboard/gl', icon: DollarSign, label: 'General Ledger', badge: null },
      { href: '/dashboard/tax', icon: Building2, label: 'Tax & Compliance', badge: null },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/inventory', icon: Package, label: 'Inventory & WMS', badge: null },
      { href: '/dashboard/orders', icon: ShoppingCart, label: 'Orders', badge: null },
      { href: '/dashboard/procurement', icon: Truck, label: 'Procurement', badge: null },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { href: '/dashboard/crm', icon: Users, label: 'CRM & Sales', badge: null },
      { href: '/dashboard/marketing', icon: Megaphone, label: 'GrowthEngine', badge: null },
      { href: '/dashboard/ecommerce', icon: CreditCard, label: 'eCommerce', badge: null },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/dashboard/payroll', icon: UserCheck, label: 'PayrollAI', badge: null },
      { href: '/dashboard/hr', icon: Briefcase, label: 'HR & Employees', badge: null },
    ],
  },
  {
    label: 'Projects',
    items: [
      { href: '/dashboard/projects', icon: Briefcase, label: 'Projects & PSA', badge: null },
      { href: '/dashboard/timesheets', icon: Clock, label: 'Timesheets', badge: null },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/dashboard/intelligence', icon: Brain, label: 'NOVA Intelligence', badge: null },
      { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics & BI', badge: null },
      { href: '/dashboard/automations', icon: Zap, label: 'Platform & AI', badge: null },
    ],
  },
  {
    label: '',
    items: [
      { href: '/dashboard/settings', icon: Settings, label: 'Settings', badge: null },
    ],
  },
]

interface DashboardLayoutProps {
  children: React.ReactNode
  inboxCount?: number
}

export default function DashboardLayout({ children, inboxCount = 0 }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#f8f8f6] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          flex flex-col bg-[#0a0a0a] border-r border-white/[0.07]
          transition-all duration-200
          ${sidebarOpen ? 'w-60' : 'w-16'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.07]">
          <div className="w-8 h-8 rounded-lg bg-[#00a855] flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white text-sm" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>N</span>
          </div>
          {sidebarOpen && (
            <span className="font-bold text-white text-[15px] tracking-tight" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
              NovaBiz OS
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-white/30 hover:text-white/70 hidden lg:block"
          >
            <ChevronRight size={14} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && sidebarOpen && (
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                const count = item.badge === 'inbox' ? inboxCount : 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={!sidebarOpen ? item.label : undefined}
                    className={`
                      flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all
                      ${active
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
                      }
                    `}
                  >
                    <item.icon size={15} className="flex-shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && (
                          <span className="bg-[#00a855] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/[0.07] p-3 flex items-center gap-2.5">
          <UserButton afterSignOutUrl="/auth/login" />
          {sidebarOpen && (
            <span className="text-white/50 text-xs">Account</span>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-12 bg-white border-b border-black/[0.07] flex items-center px-4 gap-3 flex-shrink-0">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-800"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 bg-gray-50 border border-black/[0.08] rounded-lg px-3 py-1.5">
              <Search size={13} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search everything..."
                className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none flex-1 w-full"
              />
              <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">⌘K</kbd>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/dashboard/inbox" className="relative p-1.5 text-gray-500 hover:text-gray-800">
              <Bell size={17} />
              {inboxCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#00a855] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {inboxCount > 9 ? '9+' : inboxCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
