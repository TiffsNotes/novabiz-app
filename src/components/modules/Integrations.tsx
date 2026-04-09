'use client'

import { useState, useEffect } from 'react'

const INTEGRATIONS = [
  { id: 'quickbooks', name: 'QuickBooks Online', description: 'Sync accounts, invoices, bills, customers, vendors, and transactions.', color: '#2CA01C', accent: '#E8F7E5' },
  { id: 'shopify', name: 'Shopify', description: 'Sync orders, products, customers, and inventory in real time.', color: '#96BF48', accent: '#F0F7E6' },
  { id: 'gmail', name: 'Gmail', description: 'Auto-detect invoices, receipts, vendor emails, and customer inquiries.', color: '#EA4335', accent: '#FDE8E7' },
]

export default function IntegrationsModule() {
  const [statuses, setStatuses] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [showShopifyInput, setShowShopifyInput] = useState(false)

  useEffect(() => { fetchAllStatuses() }, [])

  async function fetchAllStatuses() {
    setLoading(true)
    const results = await Promise.all(
      INTEGRATIONS.map(async (i) => {
        try {
          const res = await fetch(`/api/integrations/${i.id}`)
          return [i.id, await res.json()]
        } catch {
          return [i.id, { connected: false }]
        }
      })
    )
    setStatuses(Object.fromEntries(results))
    setLoading(false)
  }

  async function triggerSync(id: string) {
    setSyncing((p) => ({ ...p, [id]: true }))
    await fetch(`/api/integrations/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync' }),
    })
    setSyncing((p) => ({ ...p, [id]: false }))
    fetchAllStatuses()
  }

  async function disconnect(id: string) {
    if (!confirm(`Disconnect ${id}?`)) return
    await fetch(`/api/integrations/${id}`, { method: 'DELETE' })
    fetchAllStatuses()
  }

  function handleConnect(id: string) {
    if (id === 'shopify') { setShowShopifyInput(true); return }
    window.location.href = `/api/integrations/${id}/connect`
  }

  function connectShopify() {
    const shop = shopifyDomain.includes('.') ? shopifyDomain : `${shopifyDomain}.myshopify.com`
    window.location.href = `/api/integrations/shopify/connect?shop=${encodeURIComponent(shop)}`
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Integrations</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 32 }}>
        Connect your tools so NovaBiz can sync data and run your AI agents.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {INTEGRATIONS.map((integration) => {
          const status = statuses[integration.id] ?? {}
          const isConnected = status.connected ?? false
          return (
            <div key={integration.id} style={{
              border: `1px solid ${isConnected ? integration.color + '50' : '#e5e7eb'}`,
              borderRadius: 12, padding: 24, background: 'white',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{integration.name}</span>
                    {!loading && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: isConnected ? '#E1F5EE' : '#f3f4f6',
                        color: isConnected ? '#085041' : '#6b7280',
                      }}>
                        {isConnected ? '● Connected' : 'Not connected'}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                    {integration.description}
                  </p>
                  {isConnected && status.lastSyncAt && (
                    <p style={{ fontSize: 12, color: '#9ca3af' }}>
                      Last synced: {new Date(status.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                  {!isConnected && integration.id === 'shopify' && showShopifyInput && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="yourstore.myshopify.com"
                        value={shopifyDomain}
                        onChange={(e) => setShopifyDomain(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && connectShopify()}
                        style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                      />
                      <button onClick={connectShopify} style={{
                        padding: '7px 14px', borderRadius: 6, border: 'none',
                        background: integration.color, color: 'white', fontSize: 13, cursor: 'pointer',
                      }}>Connect</button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                  {isConnected ? (
                    <>
                      <button onClick={() => triggerSync(integration.id)} disabled={syncing[integration.id]} style={{
                        padding: '7px 14px', borderRadius: 6, border: `1px solid ${integration.color}`,
                        background: integration.accent, color: integration.color,
                        fontSize: 13, cursor: 'pointer', fontWeight: 500,
                      }}>
                        {syncing[integration.id] ? 'Syncing…' : 'Sync Now'}
                      </button>
                      <button onClick={() => disconnect(integration.id)} style={{
                        padding: '7px 14px', borderRadius: 6, border: '1px solid #e5e7eb',
                        background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer',
                      }}>Disconnect</button>
                    </>
                  ) : (
                    <button onClick={() => handleConnect(integration.id)} style={{
                      padding: '8px 18px', borderRadius: 6, border: 'none',
                      background: integration.color, color: 'white', fontSize: 13,
                      fontWeight: 500, cursor: 'pointer',
                    }}>Connect</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
