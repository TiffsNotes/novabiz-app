'use client'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function MarketingPage() {
  const [GrowthEngine, setGrowthEngine] = useState<any>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    import('@/components/modules/GrowthEngine')
      .then(m => setGrowthEngine(() => m.default))
      .catch(() => setError(true))
  }, [])

  return (
    <DashboardLayout>
      {error ? (
        <div style={{ padding: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>GrowthEngine</h2>
          <p style={{ color: '#666' }}>This module is loading. Please refresh the page.</p>
        </div>
      ) : GrowthEngine ? (
        <GrowthEngine />
      ) : (
        <div style={{ padding: 32, color: '#666' }}>Loading GrowthEngine...</div>
      )}
    </DashboardLayout>
  )
}
