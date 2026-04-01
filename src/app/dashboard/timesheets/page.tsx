'use client'
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Table, Button, EmptyState } from '@/components/ui'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function TimesheetsPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/psa?view=timesheets')
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        // Extract array from response
        const arr = d.entries || d.orders || d.timesheets || d.filings || d.items || d.campaigns || []
        setData(arr)
        setLoading(false)
      })
  }, [])

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <PageHeader
          title="Timesheets"
          subtitle="Time tracking, approvals, and billing"
          actions={<Button size="sm">New</Button>}
        />
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : data.length === 0 ? (
            <EmptyState icon={Clock} title="No Timesheets yet" description="Time tracking, approvals, and billing — connect your data sources to populate this module." />
          ) : (
            <Card padding={false}>
              <div className="p-4">
                <pre className="text-xs text-gray-500 overflow-auto max-h-96">{JSON.stringify(data.slice(0,5), null, 2)}</pre>
                <p className="text-xs text-gray-400 mt-2">Showing {Math.min(5, data.length)} of {data.length} records</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
