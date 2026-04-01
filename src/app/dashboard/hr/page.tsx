'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PageHeader, Card, EmptyState } from '@/components/ui'
import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function HRPage() {
  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    fetch('/api/hr?view=stats').then(r => r.ok ? r.json() : {}).then(setStats)
  }, [])
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <PageHeader title="HR & Employees" subtitle="Employee records, payroll, leave, and performance" />
        <div className="p-4 grid grid-cols-4 gap-3">
          {[
            { label: 'Headcount', value: stats?.headcount ?? 0 },
            { label: 'Monthly Payroll', value: `$${((stats?.monthlyPayroll ?? 0)/100).toLocaleString()}` },
            { label: 'Pending Leave', value: stats?.pendingLeave ?? 0 },
            { label: 'Pending Expenses', value: stats?.pendingExpenses ?? 0 },
          ].map(k => (
            <Card key={k.label}>
              <div className="text-xs text-gray-400 mb-1">{k.label}</div>
              <div className="text-2xl font-black text-gray-900">{String(k.value)}</div>
            </Card>
          ))}
        </div>
        <div className="flex-1 p-4">
          <EmptyState icon={Users} title="HR module ready" description="Employees will appear here once added or synced from Gusto." />
        </div>
      </div>
    </DashboardLayout>
  )
}
