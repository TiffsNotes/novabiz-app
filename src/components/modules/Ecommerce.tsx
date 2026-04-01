'use client'
import { useState, useEffect } from 'react'
import { ShoppingCart, Plus, Package, Truck, RefreshCw, Users, DollarSign, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, EmptyState } from '@/components/ui'

type Order = { id: string; number: string; customer?: string; total: number; status: string; paymentStatus: string; fulfillStatus: string; channel: string; createdAt: string }
type Customer = { id: string; name?: string; email?: string; totalOrders: number; totalSpent: number; segment?: string; ltv?: number; createdAt: string }
type Storefront = { id: string; name: string; platform: string; isActive: boolean; lastSync?: string }
type EcomStats = { ordersMtd: number; revenueMtd: number; newCustomers: number; aov: number; totalCustomers: number }

const fmt = (c: number) => `$${(c / 100).toLocaleString()}`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

const PLATFORM_ICONS: Record<string, string> = { shopify: '🛍️', woocommerce: '🟣', pos: '💳', amazon: '📦', direct: '🏢' }
const CHANNEL_COLORS: Record<string, 'green' | 'blue' | 'purple' | 'yellow'> = { online: 'green', pos: 'blue', phone: 'purple', manual: 'yellow' }
const FULFIL_COLORS: Record<string, 'gray' | 'blue' | 'yellow' | 'green' | 'red'> = { unfulfilled: 'red', partial: 'yellow', fulfilled: 'green', shipped: 'blue' }

export default function EcommerceModule() {
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [storefronts, setStorefronts] = useState<Storefront[]>([])
  const [stats, setStats] = useState<EcomStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/ecommerce?view=orders').then(r => r.ok ? r.json() : { orders: [] }),
      fetch('/api/ecommerce?view=customers').then(r => r.ok ? r.json() : { customers: [] }),
      fetch('/api/ecommerce?view=storefronts').then(r => r.ok ? r.json() : { storefronts: [] }),
      fetch('/api/ecommerce?view=stats').then(r => r.ok ? r.json() : {}),
    ]).then(([o, c, s, st]) => {
      setOrders(o.orders || [])
      setCustomers(c.customers || [])
      setStorefronts(s.storefronts || [])
      setStats(st)
      setLoading(false)
    })
  }, [])

  // Mock chart data
  const revenueByDay = Array.from({ length: 14 }, (_, i) => ({
    day: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: Math.round(((stats?.revenueMtd || 0) / 14) * (0.5 + Math.random()) / 100),
    orders: Math.round((stats?.ordersMtd || 0) / 14 * (0.5 + Math.random())),
  }))

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="eCommerce"
        subtitle="Omnichannel order management — online, POS, and marketplace sales in one view"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={RefreshCw}>Sync All</Button>
            <Button size="sm" icon={Plus}>New Order</Button>
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-5 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
          <StatCard label="Orders MTD" value={stats.ordersMtd.toLocaleString()} color="#d97706" />
          <StatCard label="Revenue MTD" value={fmt(stats.revenueMtd)} color="#00a855" />
          <StatCard label="Avg Order Value" value={fmt(stats.aov)} color="#2563eb" />
          <StatCard label="New Customers" value={stats.newCustomers.toString()} color="#7c3aed" />
          <StatCard label="Total Customers" value={(stats.totalCustomers || 0).toLocaleString()} color="#0891b2" />
        </div>
      )}

      <Tabs tabs={[
        { key: 'orders', label: 'Orders', count: orders.filter(o => o.fulfillStatus !== 'fulfilled').length },
        { key: 'customers', label: 'Customers', count: customers.length },
        { key: 'storefronts', label: 'Storefronts', count: storefronts.length },
        { key: 'analytics', label: 'Analytics' },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {tab === 'orders' && (
          <>
            {/* Unfulfilled alert */}
            {orders.filter(o => o.fulfillStatus === 'unfulfilled').length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3">
                <Package size={14} className="text-red-500" />
                <span className="text-sm text-red-700">
                  <strong>{orders.filter(o => o.fulfillStatus === 'unfulfilled').length} unfulfilled orders</strong> — SupplyChainAI will check inventory and fulfill automatically if stock is available.
                </span>
              </div>
            )}
            <Card padding={false}>
              <Table<Order>
                columns={[
                  { key: 'number', header: 'Order #', render: r => <span className="font-mono text-sm font-medium">{r.number}</span> },
                  { key: 'customer', header: 'Customer', render: r => <span className="text-sm text-gray-700">{r.customer || '—'}</span> },
                  { key: 'channel', header: 'Channel', render: r => (
                    <Badge variant={CHANNEL_COLORS[r.channel] || 'gray'}>{r.channel}</Badge>
                  )},
                  { key: 'total', header: 'Total', render: r => <span className="font-semibold tabular-nums">{fmt(r.total)}</span> },
                  { key: 'paymentStatus', header: 'Payment', render: r => (
                    <Badge variant={r.paymentStatus === 'paid' ? 'green' : 'yellow'}>{r.paymentStatus}</Badge>
                  )},
                  { key: 'fulfillStatus', header: 'Fulfillment', render: r => (
                    <Badge variant={FULFIL_COLORS[r.fulfillStatus] || 'gray'}>{r.fulfillStatus}</Badge>
                  )},
                  { key: 'createdAt', header: 'Date', render: r => <span className="text-xs text-gray-400">{fmtDate(r.createdAt)}</span> },
                  { key: 'actions', header: '', render: r => r.fulfillStatus === 'unfulfilled' ? (
                    <Button size="xs" variant="secondary" icon={Truck}>Fulfill</Button>
                  ) : null },
                ]}
                data={orders}
                emptyMessage="No orders yet. Connect a storefront to start syncing orders."
              />
            </Card>
          </>
        )}

        {tab === 'customers' && (
          <Card padding={false}>
            <Table<Customer>
              columns={[
                { key: 'name', header: 'Customer', render: r => (
                  <div>
                    <div className="font-medium text-sm text-gray-900">{r.name || 'Anonymous'}</div>
                    {r.email && <div className="text-xs text-gray-400">{r.email}</div>}
                  </div>
                )},
                { key: 'segment', header: 'Segment', render: r => r.segment ? (
                  <Badge variant={r.segment === 'vip' ? 'purple' : r.segment === 'at_risk' ? 'red' : 'green'}>{r.segment}</Badge>
                ) : null },
                { key: 'totalOrders', header: 'Orders', render: r => <span className="font-medium tabular-nums">{r.totalOrders}</span> },
                { key: 'totalSpent', header: 'Total Spent', render: r => <span className="font-semibold tabular-nums">{fmt(r.totalSpent)}</span> },
                { key: 'ltv', header: 'Predicted LTV', render: r => r.ltv ? <span className="text-[#00a855] font-medium tabular-nums">{fmt(r.ltv)}</span> : <span className="text-gray-300">—</span> },
                { key: 'createdAt', header: 'First Order', render: r => <span className="text-xs text-gray-400">{fmtDate(r.createdAt)}</span> },
              ]}
              data={customers}
              emptyMessage="No customers synced. Connect a storefront to import customers."
            />
          </Card>
        )}

        {tab === 'storefronts' && (
          <div className="space-y-3">
            {storefronts.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No storefronts connected"
                description="Connect Shopify, WooCommerce, Square POS, or Amazon to sync orders automatically."
                action={<Button size="sm" icon={Plus}>Connect Storefront</Button>}
              />
            ) : storefronts.map(sf => (
              <Card key={sf.id}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{PLATFORM_ICONS[sf.platform] || '🛒'}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{sf.name}</div>
                    <div className="text-xs text-gray-400">Last synced: {fmtDate(sf.lastSync)}</div>
                  </div>
                  <Badge variant={sf.isActive ? 'green' : 'gray'}>{sf.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Button size="sm" variant="secondary" icon={RefreshCw}>Sync</Button>
                </div>
              </Card>
            ))}
            <Button icon={Plus} variant="secondary" size="sm">Add Storefront</Button>
          </div>
        )}

        {tab === 'analytics' && (
          <Card>
            <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Revenue Last 14 Days</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ec" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#d97706" radius={[3, 3, 0, 0]} name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  )
}
