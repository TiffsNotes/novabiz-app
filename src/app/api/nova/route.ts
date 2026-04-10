import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXECS: Record<string, { name: string; role: string; personality: string }> = {
  cos: { name: 'NOVA CoS', role: 'Chief of Staff', personality: 'Strategic and decisive. Coordinate all business functions and give clear daily priorities. Direct, no fluff, always action-oriented.' },
  finance: { name: 'NOVA Finance', role: 'CFO', personality: 'Analytical and precise. Manage books, monitor cash flow, and flag financial risks. Clear numbers, clear recommendations.' },
  ops: { name: 'NOVA Ops', role: 'COO', personality: 'Efficient and systematic. Keep inventory stocked, orders fulfilled, procurement optimized.' },
  growth: { name: 'NOVA Growth', role: 'CMO', personality: 'Creative and data-driven. Build campaigns, manage reputation, and grow revenue.' },
  sales: { name: 'NOVA Sales', role: 'CRO', personality: 'Persistent and pipeline-obsessed. Manage the sales process and never let a lead go cold.' },
  legal: { name: 'NOVA Legal', role: 'General Counsel', personality: 'Thorough and clear. Handle compliance, contracts, and tax. Always recommend consulting a licensed attorney for major decisions.' },
  people: { name: 'NOVA People', role: 'CPO', personality: 'Empathetic and fair. Manage hiring, performance, payroll, and culture.' },
  tech: { name: 'NOVA Tech', role: 'CTO', personality: 'Technical and pragmatic. Manage integrations, automations, and the AI platform.' },
}

async function getContext(businessId: string): Promise<string> {
  const parts: string[] = []
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  try {
    const [rev, exp, headcount, openDeals, lowStock] = await Promise.all([
      db.transaction.aggregate({ where: { businessId, type: 'income', date: { gte: startOfMonth } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
      db.transaction.aggregate({ where: { businessId, type: 'expense', date: { gte: startOfMonth } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
      db.employee.count({ where: { businessId, status: 'active' } }).catch(() => 0),
      db.deal.count({ where: { businessId, status: 'open' } }).catch(() => 0),
      db.product.count({ where: { businessId, inventoryQty: { lte: 5 } } }).catch(() => 0),
    ])
    const r = Math.abs(Number(rev._sum.amount) || 0)
    const e = Math.abs(Number(exp._sum.amount) || 0)
    parts.push('Revenue MTD: $' + (r/100).toFixed(0))
    parts.push('Expenses MTD: $' + (e/100).toFixed(0))
    parts.push('Profit MTD: $' + ((r-e)/100).toFixed(0))
    parts.push('Employees: ' + headcount)
    parts.push('Open deals: ' + openDeals)
    parts.push('Low stock items: ' + lowStock)
  } catch(err) { console.error('Context error:', err) }
  return parts.join(' | ')
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { executive = 'cos', messages } = await req.json()
    const exec = EXECS[executive] || EXECS.cos
    const context = await getContext(business.id)
    const system = 'You are ' + exec.name + ', the ' + exec.role + ' for ' + business.name + '. ' + exec.personality + ' Current business data: ' + context + '. Today is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '. Keep responses concise and actionable. When asked to take an action, describe what you would do and ask for approval before proceeding.'
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })
    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply, executive: exec.name, role: exec.role })
  } catch (err: any) {
    console.error('NOVA API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
