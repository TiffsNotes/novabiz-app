import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const view = new URL(req.url).searchParams.get('view') || 'products'
    if (view === 'products') {
      const products = await db.product.findMany({ where: { businessId: business.id }, orderBy: { name: 'asc' }, take: 200 })
      return NextResponse.json({ products })
    }
    if (view === 'stats') {
      const [total, lowStock, outOfStock] = await Promise.all([
        db.product.count({ where: { businessId: business.id } }),
        db.product.count({ where: { businessId: business.id, inventoryQty: { gt: 0, lte: 10 } } }),
        db.product.count({ where: { businessId: business.id, inventoryQty: { lte: 0 } } }),
      ])
      const products = await db.product.findMany({ where: { businessId: business.id }, select: { price: true, inventoryQty: true } })
      const totalValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.inventoryQty || 0)), 0)
      return NextResponse.json({ totalSkus: total, lowStock, outOfStock, totalValue })
    }
    if (view === 'orders') {
      const orders = await db.order.findMany({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' }, take: 100 })
      return NextResponse.json({ orders })
    }
    if (view === 'order_stats') {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const [ordersMTD, revenueMTD, pending] = await Promise.all([
        db.order.count({ where: { businessId: business.id, createdAt: { gte: startOfMonth } } }),
        db.order.aggregate({ where: { businessId: business.id, createdAt: { gte: startOfMonth } }, _sum: { total: true } }),
        db.order.count({ where: { businessId: business.id, fulfillmentStatus: 'unfulfilled' } }),
      ])
      return NextResponse.json({ ordersMTD, revenueMTD: revenueMTD._sum.total || 0, pendingFulfillment: pending })
    }
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    const { action } = body
    if (action === 'create_product') {
      const { name, sku, price, inventoryQty, vendor, productType } = body
      const product = await db.product.create({ data: { businessId: business.id, name, sku, price: parseFloat(price || 0), inventoryQty: parseInt(inventoryQty || 0), vendor, productType, status: 'active', source: 'manual' } })
      return NextResponse.json({ success: true, product })
    }
    if (action === 'update_inventory') {
      const { productId, quantity } = body
      await db.product.update({ where: { id: productId }, data: { inventoryQty: parseInt(quantity) } })
      return NextResponse.json({ success: true })
    }
    if (action === 'delete_product') {
      await db.product.delete({ where: { id: body.productId } })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
