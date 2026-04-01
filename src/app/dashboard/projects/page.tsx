'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PageHeader, Card, EmptyState, Button } from '@/components/ui'
import { Briefcase } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ProjectsPage() {
  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    fetch('/api/psa?view=stats').then(r => r.ok ? r.json() : {}).then(setStats)
  }, [])
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <PageHeader title="Projects & PSA" subtitle="Project management, time tracking, and client billing" />
        <div className="p-4 grid grid-cols-4 gap-3">
          {[
            { label: 'Active Projects', value: stats?.activeProjects ?? 0 },
            { label: 'Billable Hours MTD', value: `${(stats?.billableHoursMtd ?? 0).toFixed(1)}h` },
            { label: 'Pending Timesheets', value: stats?.pendingTimesheets ?? 0 },
            { label: 'Pending Expenses', value: stats?.pendingExpenses ?? 0 },
          ].map(k => (
            <Card key={k.label}>
              <div className="text-xs text-gray-400 mb-1">{k.label}</div>
              <div className="text-2xl font-black text-gray-900">{String(k.value)}</div>
            </Card>
          ))}
        </div>
        <div className="flex-1 p-4">
          <EmptyState icon={Briefcase} title="No projects yet" description="Create your first project to start tracking time and billing clients." action={<Button size="sm">New Project</Button>} />
        </div>
      </div>
    </DashboardLayout>
  )
}
