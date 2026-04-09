import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { GrowthEngine } from '@/lib/ai/growth'

export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const view = new URL(req.url).searchParams.get('view') || 'campaigns'

  if (view === 'campaigns') {
    const campaigns = await db.campaign.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ campaigns })
  }

  if (view === 'stats') {
    try {
      const engine = new GrowthEngine(business.id)
      return NextResponse.json(await engine.getMarketingSummary())
    } catch (e) {
      return NextResponse.json({ campaignsSent30Days: 0, scheduledPosts: 0, draftCampaigns: 0 })
    }
  }

  return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const { orgId, userId } = await auth()
  const id = orgId || userId
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: id } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { action, ...data } = await req.json()
  const engine = new GrowthEngine(business.id)

  if (action === 'generate_campaign') {
    const campaignId = await engine.createEmailCampaign({
      goal: data.goal,
      audience: data.audience,
      productOrTopic: data.topic,
    })
    const campaign = await db.campaign.findUnique({ where: { id: campaignId } })
    return NextResponse.json({ id: campaignId, content: campaign?.content })
  }

  if (action === 'generate_social_calendar') {
    const count = await engine.generateSocialCalendar(data.platforms || ['instagram', 'facebook'])
    return NextResponse.json({ count })
  }

  if (action === 'generate_review_response') {
    const response = await engine.generateReviewResponse({
      platform: data.platform || 'Google',
      rating: data.rating || 5,
      text: data.text,
      customerName: data.customerName,
    })
    return NextResponse.json({ response })
  }

  if (action === 'analyze_performance') {
    const analysis = await engine.analyzeCampaignPerformance()
    return NextResponse.json({ analysis })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
