import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []

      // Check for low stock items and create reorder alerts
      const lowStockItems = await db.product.findMany({
        where: {
          businessId: business.id,
          status: 'active',
          inventoryQty: { lte: 10, gt: 0 },
        },
      })

      for (const item of lowStockItems) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'reorder',
            title: 'Reorder needed: ' + item.name,
            description: 'Current stock: ' + item.inventoryQty + ' units. Recommend ordering ' + Math.max(50, (item.inventoryQty || 0) * 3) + ' units from ' + (item.vendor || 'vendor'),
            severity: 'warning',
            module: 'inventory',
            actionRequired: true,
            data: { productId: item.id, currentQty: item.inventoryQty, suggestedQty: Math.max(50, (item.inventoryQty || 0) * 3) },
          },
        }).catch(() => null)
        actions.push('Reorder alert: ' + item.name)
      }

      // Check for out of stock items
      const outOfStock = await db.product.findMany({
        where: {
          businessId: business.id,
          status: 'active',
          inventoryQty: { lte: 0 },
        },
      })

      for (const item of outOfStock) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'out_of_stock',
            title: 'OUT OF STOCK: ' + item.name,
            description: 'This item is out of stock and may be causing lost sales. Immediate reorder recommended.',
            severity: 'critical',
            module: 'inventory',
            actionRequired: true,
            data: { productId: item.id },
          },
        }).catch(() => null)
        actions.push('Out of stock: ' + item.name)
      }

      // Check for unfulfilled orders older than 2 days
      const overdueOrders = await db.order.findMany({
        where: {
          businessId: business.id,
          fulfillmentStatus: 'unfulfilled',
          createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        },
        take: 20,
      })

      for (const order of overdueOrders) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'overdue_fulfillment',
            title: 'Order overdue: #' + order.orderNumber,
            description: 'Order from ' + (order.customerName || 'customer') + ' has not been fulfilled after 2+ days. Total: $' + ((order.total || 0) / 100).toFixed(2),
            severity: 'warning',
            module: 'orders',
            actionRequired: true,
            data: { orderId: order.id },
          },
        }).catch(() => null)
        actions.push('Overdue order: ' + order.orderNumber)
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('SupplyChain agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
