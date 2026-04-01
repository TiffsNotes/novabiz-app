'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PageHeader, Card, EmptyState } from '@/components/ui'
import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function CRMPage() {
  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    fetch('/api/crm?view=stats').then(r => r.ok ? r.json() : {}).then(setStats)
  }, [])
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <PageHeader title="CRM & SalesFlow" subtitle="Pipeline, contacts, and deals" />
        <div className="p-4 grid grid-cols-4 gap-3">
          {[
            { label: 'Total Contacts', value: stats?.totalContacts ?? 0 },
            { label: 'Open Deals', value: stats?.totalDeals ?? 0 },
            { label: 'Pipeline Value', value: `$${((stats?.pipelineValue ?? 0)/100).toLocaleString()}` },
            { label: 'Won This Month', value: `$${((stats?.wonThisMonth ?? 0)/100).toLocaleString()}` },
          ].map(k => (
            <Card key={k.label}>
              <div className="text-xs text-gray-400 mb-1">{k.label}</div>
              <div className="text-2xl font-black text-gray-900">{String(k.value)}</div>
            </Card>
          ))}
        </div>
        <div className="flex-1 p-4"><EmptyState icon={Users} title="Add your first contact" description="Import contacts or add them manually to get started." /></div>
      </div>
    </DashboardLayout>
  )
}
