'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PageHeader, Card, EmptyState, Button } from '@/components/ui'
import { UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function PayrollPage() {
  const [summary, setSummary] = useState<any>(null)
  useEffect(() => {
    fetch('/api/hr?view=payroll').then(r => r.ok ? r.json() : {}).then(setSummary)
  }, [])
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <PageHeader title="PayrollAI" subtitle="Automated payroll processing and tax management" />
        <div className="p-4 grid grid-cols-4 gap-3">
          {[
            { label: 'Employees', value: summary?.employeeCount ?? 0 },
            { label: 'Monthly Payroll', value: `$${((summary?.estimatedMonthlyPayroll ?? 0)/100).toLocaleString()}` },
            { label: 'YTD Payroll', value: `$${((summary?.ytdPayroll ?? 0)/100).toLocaleString()}` },
            { label: 'Last Run', value: summary?.lastRunDate ? new Date(summary.lastRunDate).toLocaleDateString() : 'None' },
          ].map(k => (
            <Card key={k.label}>
              <div className="text-xs text-gray-400 mb-1">{k.label}</div>
              <div className="text-2xl font-black text-gray-900">{String(k.value)}</div>
            </Card>
          ))}
        </div>
        <div className="flex-1 p-4">
          <EmptyState icon={UserCheck} title="PayrollAI ready" description="Connect Gusto to sync employees and run payroll automatically." action={<Button size="sm">Connect Gusto</Button>} />
        </div>
      </div>
    </DashboardLayout>
  )
}
