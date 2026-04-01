'use client'
import { useState, useRef, useEffect } from 'react'
import { Zap, Plus, MessageSquare, Plug, Settings, ChevronRight, Check, RefreshCw, Send, Bot, Workflow } from 'lucide-react'
import { PageHeader, Card, Badge, Tabs, Button, EmptyState, Modal, Input, Select } from '@/components/ui'

// ─── CONVERSATIONAL AI CHAT ──────────────────────────────────
type Message = { role: 'user' | 'assistant'; content: string; timestamp: Date }

function ConversationalAI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm NOVA, your AI Chief of Staff. Ask me anything about your business — financials, pipeline, inventory, payroll, or anything else. I have full context on your operations.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const res = await fetch('/api/platform/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input, history: messages.map(m => ({ role: m.role, content: m.content })) }),
    })

    const data = res.ok ? await res.json() : { reply: "I'm having trouble connecting right now. Please try again in a moment." }
    setMessages(prev => [...prev, { role: 'assistant', content: data.reply, timestamp: new Date() }])
    setLoading(false)
  }

  const SUGGESTIONS = [
    "What's my cash flow looking like for the next 30 days?",
    "Which deals in my pipeline are most at risk?",
    "Which SKUs need to be reordered this week?",
    "Summarize last month's P&L for me",
    "Who are my top 5 customers by revenue?",
    "What's my projected payroll for next pay period?",
  ]

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">N</span>
              </div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#0a0a0a] text-white rounded-tr-sm'
                : 'bg-white border border-black/[0.07] text-gray-700 rounded-tl-sm'
            }`}>
              {msg.content}
              <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/50 text-right' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div className="bg-white border border-black/[0.07] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setInput(s)} className="text-xs bg-gray-50 border border-black/[0.07] text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 border-t border-black/[0.07]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask NOVA anything about your business..."
            className="flex-1 border border-black/[0.08] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0a0a0a]"
          />
          <Button onClick={send} loading={loading} icon={Send} size="sm">Send</Button>
        </div>
      </div>
    </div>
  )
}

// ─── INTEGRATIONS HUB ────────────────────────────────────────
const INTEGRATIONS = [
  { id: 'plaid', name: 'Plaid', category: 'Banking', description: 'Connect bank accounts for real-time transaction sync', icon: '🏦', connected: true },
  { id: 'gusto', name: 'Gusto', category: 'Payroll', description: 'Full payroll integration — run payroll from NovaBiz', icon: '👥', connected: false },
  { id: 'quickbooks', name: 'QuickBooks', category: 'Accounting', description: 'Two-way sync with your existing QuickBooks company', icon: '📊', connected: false },
  { id: 'shopify', name: 'Shopify', category: 'eCommerce', description: 'Sync orders, products, and customers automatically', icon: '🛍️', connected: false },
  { id: 'stripe', name: 'Stripe', category: 'Payments', description: 'Sync payments, invoices, and subscription revenue', icon: '💳', connected: false },
  { id: 'xero', name: 'Xero', category: 'Accounting', description: 'Alternative to QuickBooks — full two-way sync', icon: '📗', connected: false },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', description: 'Sync contacts, deals, and activities bidirectionally', icon: '🔶', connected: false },
  { id: 'square', name: 'Square', category: 'POS', description: 'Sync point-of-sale transactions and inventory', icon: '⬛', connected: false },
  { id: 'amazon', name: 'Amazon Seller', category: 'eCommerce', description: 'Sync Amazon orders and inventory automatically', icon: '📦', connected: false },
  { id: 'adp', name: 'ADP', category: 'Payroll', description: 'Import employee and payroll data from ADP', icon: '🏢', connected: false },
  { id: 'gmail', name: 'Gmail', category: 'Email', description: 'Link email threads to contacts and deals in CRM', icon: '📧', connected: false },
  { id: 'slack', name: 'Slack', category: 'Communication', description: 'Get NovaBiz notifications and approvals in Slack', icon: '💬', connected: false },
]

function IntegrationsHub() {
  const [filter, setFilter] = useState('all')
  const categories = ['all', ...new Set(INTEGRATIONS.map(i => i.category))]
  const filtered = filter === 'all' ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${filter === c ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {c === 'all' ? `All (${INTEGRATIONS.length})` : c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {filtered.map(intg => (
          <div key={intg.id} className="bg-white border border-black/[0.07] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{intg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">{intg.name}</span>
                  {intg.connected && <Badge variant="green">Connected</Badge>}
                </div>
                <span className="text-xs text-gray-400">{intg.category}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{intg.description}</p>
            <Button size="xs" variant={intg.connected ? 'secondary' : 'primary'} icon={intg.connected ? Check : Plug}>
              {intg.connected ? 'Manage' : 'Connect'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── WORKFLOW BUILDER ─────────────────────────────────────────
const WORKFLOW_TEMPLATES = [
  { name: 'Invoice overdue reminder', trigger: 'Invoice overdue by 7 days', action: 'Send email reminder to client', module: 'Finance' },
  { name: 'Low inventory alert', trigger: 'Product stock ≤ reorder point', action: 'Create PO + notify in CommandInbox', module: 'ERP' },
  { name: 'New lead follow-up', trigger: 'New contact added to CRM', action: 'Send welcome email sequence', module: 'CRM' },
  { name: 'Payroll reminder', trigger: 'Every Monday 8am', action: 'Preview payroll + notify for approval', module: 'HR' },
  { name: 'Weekly P&L digest', trigger: 'Every Monday 7am', action: 'Email P&L summary to owners', module: 'Finance' },
  { name: 'Expense approval', trigger: 'Expense > $500 submitted', action: 'Request approval in CommandInbox', module: 'PSA' },
]

function WorkflowBuilder() {
  return (
    <div className="space-y-4">
      <div className="bg-[#0a0a0a] rounded-xl p-4 flex items-center gap-3">
        <Zap size={18} className="text-[#00a855]" />
        <div>
          <div className="font-semibold text-white text-sm">AI Workflow Engine</div>
          <div className="text-white/50 text-xs">Create custom automations or start from a template. Workflows run automatically without you.</div>
        </div>
        <Button size="sm" variant="success" icon={Plus} className="ml-auto flex-shrink-0">New Workflow</Button>
      </div>

      <div className="font-semibold text-gray-700 text-sm">Templates</div>
      <div className="grid grid-cols-2 gap-3">
        {WORKFLOW_TEMPLATES.map(wf => (
          <div key={wf.name} className="bg-white border border-black/[0.07] rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-sm text-gray-900">{wf.name}</div>
                <Badge variant="blue">{wf.module}</Badge>
              </div>
              <Button size="xs" variant="secondary">Enable</Button>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2 text-xs">
                <span className="text-gray-400 w-12 flex-shrink-0">Trigger</span>
                <span className="text-gray-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">{wf.trigger}</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="text-gray-400 w-12 flex-shrink-0">Action</span>
                <span className="text-gray-700 bg-[#e8f8f0] px-2 py-0.5 rounded-md border border-[#00a855]/20">{wf.action}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function PlatformModule() {
  const [tab, setTab] = useState('ai')

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Platform"
        subtitle="Conversational AI, workflow automation, integrations, and customization tools"
      />

      <Tabs tabs={[
        { key: 'ai', label: 'NOVA AI Assistant' },
        { key: 'workflows', label: 'Automations' },
        { key: 'integrations', label: 'Integrations', count: INTEGRATIONS.filter(i => !i.connected).length },
        { key: 'customize', label: 'Customize' },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4">
        {tab === 'ai' && (
          <Card padding={false}>
            <ConversationalAI />
          </Card>
        )}
        {tab === 'workflows' && <WorkflowBuilder />}
        {tab === 'integrations' && <IntegrationsHub />}
        {tab === 'customize' && (
          <EmptyState icon={Settings} title="Custom Dashboards & Branding" description="Build custom dashboards, configure role-based views, and white-label the platform for your team. Coming in Enterprise plan." />
        )}
      </div>
    </div>
  )
}
