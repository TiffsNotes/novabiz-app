import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { getExecutiveDashboard } from '@/lib/ai/bi'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { message, history } = await req.json()

  // Get live business context for grounding
  const dashboard = await getExecutiveDashboard(business.id).catch(() => null)

  const systemPrompt = `You are NOVA, the AI Chief of Staff for ${business.name}.
You have complete knowledge of their business operations and answer questions based on real data.

Current business snapshot:
${dashboard ? JSON.stringify(dashboard, null, 2) : 'Data loading...'}

You can answer questions about:
- Financial performance, P&L, cash flow, invoices, expenses
- Sales pipeline, deals, CRM, lead scores
- Inventory levels, purchase orders, stock status
- Payroll, employees, HR metrics
- Project status, timesheets, utilization
- eCommerce orders, customer metrics
- Any operational question about the business

Be direct, specific, and use the actual numbers from their data.
Format numbers as currency when relevant. Be conversational but professional.
If you don't have data on something, say so honestly and explain how to get it.`

  const messages = [
    ...((history || []).slice(-10) as Array<{ role: 'user' | 'assistant'; content: string }>),
    { role: 'user' as const, content: message },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const reply = (response.content[0] as { type: string; text: string }).text

  return NextResponse.json({ reply })
}
