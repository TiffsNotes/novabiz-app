import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { createAiAction } from '@/lib/ai/actions'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export class GrowthEngine {
  private businessId: string
  constructor(b: string) { this.businessId = b }

  // Generate email campaign
  async createEmailCampaign(params: {
    goal: string   // "re-engage inactive customers" | "promote new product" | "monthly newsletter"
    audience: string
    productOrTopic?: string
  }): Promise<string> {
    const business = await db.business.findUniqueOrThrow({
      where: { id: this.businessId },
      select: { name: true, industry: true },
    })

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `You are the AI marketing director for ${business.name}, a ${business.industry} business.
Write compelling, conversion-focused email campaigns.
Return JSON: { "subject": "...", "preheader": "...", "body": "...", "cta": "...", "ctaUrl": "..." }`,
      messages: [{
        role: 'user',
        content: `Create an email campaign:
Goal: ${params.goal}
Audience: ${params.audience}
${params.productOrTopic ? `Topic: ${params.productOrTopic}` : ''}

Make it personal, specific to a ${business.industry} business, and focused on value for the reader.`,
      }],
    })

    const content = JSON.parse((res.content[0] as { type: string; text: string }).text)

    const campaign = await db.campaign.create({
      data: {
        businessId: this.businessId,
        name: `${params.goal} - ${new Date().toLocaleDateString()}`,
        type: 'email',
        status: 'draft',
        content,
        platforms: ['email'],
        aiGenerated: true,
      },
    })

    // Queue for approval
    const action = await createAiAction({
      businessId: this.businessId,
      module: 'GROWTH',
      actionType: 'send_email_campaign',
      title: `Email: ${content.subject}`,
      description: `AI-drafted email campaign for "${params.audience}" · Goal: ${params.goal}`,
      payload: { campaignId: campaign.id },
      requiresApproval: true,
      approvalReason: 'Review AI-drafted campaign before sending',
      status: 'PENDING_APPROVAL',
    })

    await db.inboxItem.create({
      data: {
        businessId: this.businessId,
        actionId: action.id,
        title: `Review campaign: "${content.subject}"`,
        description: `${params.goal} · ${params.audience}`,
        module: 'GROWTH',
        urgency: 'NORMAL',
      },
    })

    return campaign.id
  }

  // Generate 7 days of social media posts
  async generateSocialCalendar(platforms: string[]): Promise<number> {
    const business = await db.business.findUniqueOrThrow({
      where: { id: this.businessId },
      select: { name: true, industry: true },
    })

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: `You are the social media manager for ${business.name}, a ${business.industry} business.
Create engaging, authentic social media content.
Return JSON array: [{ "day": 1, "platform": "instagram", "caption": "...", "hashtags": [...], "type": "educational|promotional|engaging" }]`,
      messages: [{
        role: 'user',
        content: `Create 7 days of social media posts for ${platforms.join(', ')}.
Mix educational content (40%), engaging questions (30%), and product/service promotion (30%).
Each post should feel authentic for a ${business.industry} business owner.`,
      }],
    })

    const posts = JSON.parse((res.content[0] as { type: string; text: string }).text)

    let created = 0
    for (const post of posts) {
      const scheduledDate = new Date()
      scheduledDate.setDate(scheduledDate.getDate() + post.day)
      scheduledDate.setHours(10, 0, 0) // 10am

      const campaign = await db.campaign.create({
        data: {
          businessId: this.businessId,
          name: `${post.platform} - Day ${post.day}`,
          type: 'social',
          status: 'scheduled',
          content: post,
          platforms: [post.platform],
          scheduledAt: scheduledDate,
          aiGenerated: true,
        },
      })
      created++
    }

    return created
  }

  // Analyze campaign performance and suggest optimizations
  async analyzeCampaignPerformance(): Promise<string> {
    const campaigns = await db.campaign.findMany({
      where: { businessId: this.businessId, status: 'sent', metrics: { not: null } },
      orderBy: { sentAt: 'desc' },
      take: 10,
    })

    if (!campaigns.length) return 'No sent campaigns with metrics yet.'

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze these campaign metrics and give 3 specific optimization recommendations:
${JSON.stringify(campaigns.map(c => ({ name: c.name, type: c.type, metrics: c.metrics })), null, 2)}`,
      }],
    })

    return (res.content[0] as { type: string; text: string }).text
  }

  // AI-powered review response generator
  async generateReviewResponse(review: {
    platform: string
    rating: number
    text: string
    customerName?: string
  }): Promise<string> {
    const business = await db.business.findUniqueOrThrow({
      where: { id: this.businessId },
      select: { name: true, industry: true },
    })

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a professional, warm response to this ${review.rating}-star review for ${business.name}:
"${review.text}"
From: ${review.customerName || 'Customer'}
Platform: ${review.platform}
Keep it under 3 sentences. Be genuine, not corporate.`,
      }],
    })

    return (res.content[0] as { type: string; text: string }).text
  }

  // Marketing summary for dashboard
  async getMarketingSummary() {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

    const [totalCampaigns, scheduledPosts, draftCampaigns] = await Promise.all([
      db.campaign.count({ where: { businessId: this.businessId, status: 'sent', sentAt: { gte: thirtyDaysAgo } } }),
      db.campaign.count({ where: { businessId: this.businessId, status: 'scheduled' } }),
      db.campaign.count({ where: { businessId: this.businessId, status: 'draft' } }),
    ])

    return {
      campaignsSent30Days: totalCampaigns,
      scheduledPosts,
      draftCampaigns,
    }
  }
}
