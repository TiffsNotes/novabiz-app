import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []

      // Check for low stock inventory items
      const lowStockItems = await db.inventoryItem.findMany({
        where: {
          businessId: business.id,
          qtyOnHand: { lte: 10, gt: 0 },
        },
        include: { product: true },
        take: 20,
      }).catch(() => [])

      for (const item of lowStockItems) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'reorder',
            title: 'Reorder needed: ' + (item.product?.name || 'Unknown item'),
            description: 'Current stock: ' + item.qtyOnHand + ' units. Recommend ordering ' + Math.max(50, (item.qtyOnHand || 0) * 3) + ' units.',
            severity: 'warning',
            module: 'inventory',
            actionRequired: true,
            data: { inventoryItemId: item.id, currentQty: item.qtyOnHand },
          },
        }).catch(() => null)
        actions.push('Reorder alert: ' + (item.product?.name || 'Unknown'))
      }

      // Check for out of stock items
      const outOfStock = await db.inventoryItem.findMany({
        where: {
          businessId: business.id,
          qtyOnHand: { lte: 0 },
        },
        include: { product: true },
        take: 20,
      }).catch(() => [])

      for (const item of outOfStock) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'out_of_stock',
            title: 'OUT OF STOCK: ' + (item.product?.name || 'Unknown item'),
            description: 'This item is out of stock. Immediate reorder recommended.',
            severity: 'critical',
            module: 'inventory',
            actionRequired: true,
            data: { inventoryItemId: item.id },
          },
        }).catch(() => null)
        actions.push('Out of stock: ' + (item.product?.name || 'Unknown'))
      }

      // Check for unfulfilled sales orders older than 2 days
      const overdueOrders = await db.salesOrder.findMany({
        where: {
          businessId: business.id,
          status: 'confirmed',
          createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        },
        take: 20,
      }).catch(() => [])

      for (const order of overdueOrders) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'overdue_fulfillment',
            title: 'Order overdue: #' + (order.orderNumber || order.id.slice(-6)),
            description: 'Order has not been fulfilled after 2+ days.',
            severity: 'warning',
            module: 'orders',
            actionRequired: true,
            data: { orderId: order.id },
          },
        }).catch(() => null)
        actions.push('Overdue order flagged')
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('SupplyChain agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
