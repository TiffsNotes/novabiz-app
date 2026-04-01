'use client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PageHeader, EmptyState, Button } from '@/components/ui'
import { ShoppingCart } from 'lucide-react'

export default function EcommercePage() {
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <PageHeader title="eCommerce" subtitle="Omnichannel order management across all your storefronts" />
        <div className="flex-1 p-4">
          <EmptyState icon={ShoppingCart} title="No storefronts connected" description="Connect Shopify, WooCommerce, or Square POS to sync orders automatically." action={<Button size="sm">Connect Storefront</Button>} />
        </div>
      </div>
    </DashboardLayout>
  )
}
