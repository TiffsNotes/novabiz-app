import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { startOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const view = new URL(req.url).searchParams.get('view') || 'orders'

  if (view === 'orders') {
    const orders = await db.ecomOrder.findMany({
      where: { businessId: business.id },
      include: { customer: true, storefront: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      orders: orders.map(o => ({
        id: o.id, number: o.number,
        customer: o.customer ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') : undefined,
        total: o.total, status: o.status, paymentStatus: o.paymentStatus,
        fulfillStatus: o.fulfillStatus, channel: o.channel, createdAt: o.createdAt,
      })),
    })
  }

  if (view === 'customers') {
    const customers = await db.customer.findMany({
      where: { businessId: business.id },
      orderBy: { totalSpent: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      customers: customers.map(c => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || undefined,
        email: c.email, totalOrders: c.totalOrders,
        totalSpent: c.totalSpent, segment: c.segment, ltv: c.ltv, createdAt: c.createdAt,
      })),
    })
  }

  if (view === 'storefronts') {
    const storefronts = await db.storefront.findMany({ where: { businessId: business.id } })
    return NextResponse.json({ storefronts })
  }

  if (view === 'stats') {
    const mtdStart = startOfMonth(new Date())
    const [orders, revenue, newCustomers, totalCustomers] = await Promise.all([
      db.ecomOrder.count({ where: { businessId: business.id, createdAt: { gte: mtdStart } } }),
      db.ecomOrder.aggregate({
        where: { businessId: business.id, createdAt: { gte: mtdStart }, status: { notIn: ['cancelled'] } },
        _sum: { total: true },
      }),
      db.customer.count({ where: { businessId: business.id, createdAt: { gte: mtdStart } } }),
      db.customer.count({ where: { businessId: business.id } }),
    ])
    return NextResponse.json({
      ordersMtd: orders,
      revenueMtd: revenue._sum.total || 0,
      newCustomers,
      aov: orders > 0 ? Math.round((revenue._sum.total || 0) / orders) : 0,
      totalCustomers,
    })
  }

  return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
}
