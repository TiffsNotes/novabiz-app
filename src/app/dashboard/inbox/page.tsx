'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PageHeader, Card, EmptyState, Badge, Button } from '@/components/ui'
import { CheckSquare, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function InboxPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/inbox')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => { setItems(d.items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <PageHeader
          title="CommandInbox"
          subtitle="AI actions waiting for your approval"
          actions={<Button size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>}
        />
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={CheckSquare} title="All caught up!" description="No pending approvals. NovaBiz will notify you when actions need your review." />
          ) : (
            <div className="space-y-2">
              {items.map((item: any) => (
                <Card key={item.id}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{item.description}</div>
                    </div>
                    <Badge variant={item.urgency === 'CRITICAL' ? 'red' : item.urgency === 'HIGH' ? 'yellow' : 'blue'}>
                      {item.urgency}
                    </Badge>
                    <div className="flex gap-2">
                      <Button size="xs" variant="success" onClick={() => fetch('/api/inbox', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'approve', itemId: item.id }) }).then(load)}>Approve</Button>
                      <Button size="xs" variant="secondary" onClick={() => fetch('/api/inbox', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'reject', itemId: item.id }) }).then(load)}>Reject</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
