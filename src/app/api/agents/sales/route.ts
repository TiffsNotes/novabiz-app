import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const businesses = await db.business.findMany()
    const results = []

    for (const business of businesses) {
      const actions: string[] = []
      const now = new Date()

      // Find deals that haven't been updated in 7+ days
      const staleDeals = await db.deal.findMany({
        where: {
          businessId: business.id,
          status: 'open',
          updatedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: { contact: true },
        take: 20,
      })

      for (const deal of staleDeals) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'follow_up',
            title: 'Deal needs follow-up: ' + deal.title,
            description: 'No activity in 7+ days. Contact: ' + (deal.contact?.displayName || 'Unknown') + '. Value: $' + ((deal.value || 0) / 100).toFixed(0),
            severity: 'warning',
            module: 'crm',
            actionRequired: true,
            data: { dealId: deal.id, contactId: deal.contactId },
          },
        }).catch(() => null)
        actions.push('Follow-up flagged: ' + deal.title)
      }

      // Score leads - mark high value deals as priority
      const highValueDeals = await db.deal.findMany({
        where: {
          businessId: business.id,
          status: 'open',
          value: { gte: 1000000 },
          probability: { lt: 70 },
        },
      })

      for (const deal of highValueDeals) {
        await db.deal.update({
          where: { id: deal.id },
          data: { probability: Math.min(70, (deal.probability || 50) + 10) },
        }).catch(() => null)
        actions.push('Scored high-value deal: ' + deal.title)
      }

      // Flag deals close to expected close date
      const closingSoon = await db.deal.findMany({
        where: {
          businessId: business.id,
          status: 'open',
          expectedCloseDate: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      })

      for (const deal of closingSoon) {
        await db.inboxItem.create({
          data: {
            businessId: business.id,
            type: 'closing_soon',
            title: 'Deal closing this week: ' + deal.title,
            description: 'Expected close: ' + deal.expectedCloseDate?.toLocaleDateString() + '. Value: $' + ((deal.value || 0) / 100).toFixed(0) + '. Probability: ' + deal.probability + '%',
            severity: 'info',
            module: 'crm',
            actionRequired: false,
            data: { dealId: deal.id },
          },
        }).catch(() => null)
        actions.push('Close reminder: ' + deal.title)
      }

      results.push({ business: business.name, actions })
    }

    return NextResponse.json({ success: true, results, runAt: new Date().toISOString() })
  } catch (err: any) {
    console.error('Sales agent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
