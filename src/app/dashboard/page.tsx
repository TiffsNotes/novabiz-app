import DashboardLayout from '@/components/layout/DashboardLayout'

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Welcome to NovaBiz OS</h1>
        <p style={{ color: '#666' }}>Dashboard is loading...</p>
      </div>
    </DashboardLayout>
  )
}
