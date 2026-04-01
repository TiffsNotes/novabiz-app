import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { createAiAction } from '@/lib/ai/actions'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export class CRMAgent {
  private businessId: string
  constructor(b: string) { this.businessId = b }

  // Score all unscored leads
  async scoreLeads(): Promise<void> {
    const contacts = await db.contact.findMany({
      where: { businessId: this.businessId, score: null, isActive: true },
      include: { activities: true, deals: true, company: true },
      take: 50,
    })
    if (!contacts.length) return

    const prompt = `Score these sales leads 0-100 based on engagement, company fit, and deal signals.
Return JSON: { "scores": [{ "id": "...", "score": 75, "reasoning": "..." }] }`

    const contactData = contacts.map(c => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      company: c.company?.name,
      title: c.title,
      stage: c.stage,
      activityCount: c.activities.length,
      dealCount: c.deals.length,
      lastContact: c.lastContact,
      source: c.source,
    }))

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: `${prompt}\n\n${JSON.stringify(contactData)}` }],
    })

    const text = (res.content[0] as { type: string; text: string }).text
    const { scores } = JSON.parse(text)

    for (const { id, score } of scores) {
      await db.contact.update({ where: { id }, data: { score } })
    }
  }

  // Generate AI deal insights
  async analyzeDeal(dealId: string): Promise<string> {
    const deal = await db.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { contact: true, company: true, activities: { orderBy: { createdAt: 'desc' }, take: 10 } },
    })

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Analyze this deal and provide a 2-3 sentence insight on likelihood of closing and recommended next action:
Deal: ${deal.name} | Value: $${(deal.value || 0) / 100} | Stage: ${deal.stage} | ${deal.probability}% probability
Contact: ${deal.contact?.firstName} ${deal.contact?.lastName} at ${deal.company?.name}
Recent activities: ${deal.activities.map(a => `${a.type}: ${a.title}`).join('; ')}
Expected close: ${deal.expectedClose?.toLocaleDateString()}`
      }],
    })

    const insight = (res.content[0] as { type: string; text: string }).text

    await db.deal.update({ where: { id: dealId }, data: { aiInsights: insight } })
    return insight
  }

  // Generate follow-up sequences for stale deals
  async generateFollowUps(): Promise<number> {
    const staleDays = 7
    const cutoff = new Date(Date.now() - staleDays * 86400000)

    const staleDeals = await db.deal.findMany({
      where: {
        businessId: this.businessId,
        wonLost: null,
        updatedAt: { lt: cutoff },
        stage: { notIn: ['closed_won', 'closed_lost'] },
      },
      include: { contact: true, company: true },
      take: 20,
    })

    let queued = 0
    for (const deal of staleDeals) {
      const emailRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Write a short (3 sentence) follow-up email for a stale sales deal.
Contact: ${deal.contact?.firstName} at ${deal.company?.name}
Deal: ${deal.name} | $${(deal.value || 0) / 100} | Stage: ${deal.stage}
Last updated: ${deal.updatedAt.toLocaleDateString()}
Be warm, not pushy. Subject line + body.`
        }],
      })

      const emailDraft = (emailRes.content[0] as { type: string; text: string }).text

      const action = await createAiAction({
        businessId: this.businessId,
        module: 'SALES',
        actionType: 'send_followup_email',
        title: `Follow-up: ${deal.contact?.firstName} at ${deal.company?.name}`,
        description: `Deal "${deal.name}" has been stale for ${staleDays}+ days`,
        payload: { dealId: deal.id, contactId: deal.contactId, emailDraft },
        requiresApproval: true,
        approvalReason: 'Review AI-drafted follow-up before sending',
        status: 'PENDING_APPROVAL',
      })

      await db.inboxItem.create({
        data: {
          businessId: this.businessId,
          actionId: action.id,
          title: `Send follow-up to ${deal.contact?.firstName} (${deal.name})`,
          description: emailDraft.substring(0, 150) + '...',
          module: 'SALES',
          urgency: 'NORMAL',
        },
      })
      queued++
    }

    return queued
  }

  // Pipeline summary for dashboard
  async getPipelineSummary() {
    const deals = await db.deal.findMany({
      where: { businessId: this.businessId, wonLost: null },
      select: { stage: true, value: true, probability: true, currency: true, createdAt: true, closedAt: true },
    })

    const stages = ['prospect', 'qualified', 'proposal', 'negotiation']
    const byStage = stages.map(stage => ({
      stage,
      count: deals.filter(d => d.stage === stage).length,
      value: deals.filter(d => d.stage === stage).reduce((s, d) => s + (d.value || 0), 0),
    }))

    const weightedPipeline = deals.reduce((sum, d) => sum + (d.value || 0) * (d.probability / 100), 0)
    const totalPipeline = deals.reduce((sum, d) => sum + (d.value || 0), 0)

    // Won this month
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const wonThisMonth = await db.deal.findMany({
      where: { businessId: this.businessId, wonLost: 'won', closedAt: { gte: thisMonth } },
      select: { value: true },
    })

    return {
      totalDeals: deals.length,
      totalPipeline,
      weightedPipeline: Math.round(weightedPipeline),
      wonThisMonth: wonThisMonth.reduce((s, d) => s + (d.value || 0), 0),
      wonCountThisMonth: wonThisMonth.length,
      byStage,
      avgDealSize: deals.length ? Math.round(totalPipeline / deals.length) : 0,
    }
  }
}
