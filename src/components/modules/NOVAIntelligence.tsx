'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, TrendingUp, Package, Megaphone, Users, Scale, Heart, Cpu, Star } from 'lucide-react'

const EXECUTIVES = [
  { id: 'cos', name: 'NOVA CoS', role: 'Chief of Staff', color: '#6366f1', bg: '#EEF2FF', description: 'Daily brief, priorities, coordination' },
  { id: 'finance', name: 'NOVA Finance', role: 'CFO', color: '#10b981', bg: '#ECFDF5', description: 'Books, cash flow, invoices, forecasting' },
  { id: 'ops', name: 'NOVA Ops', role: 'COO', color: '#f59e0b', bg: '#FFFBEB', description: 'Inventory, orders, procurement' },
  { id: 'growth', name: 'NOVA Growth', role: 'CMO', color: '#ec4899', bg: '#FDF2F8', description: 'Marketing, campaigns, reputation' },
  { id: 'sales', name: 'NOVA Sales', role: 'CRO', color: '#3b82f6', bg: '#EFF6FF', description: 'Pipeline, deals, follow-ups' },
  { id: 'legal', name: 'NOVA Legal', role: 'General Counsel', color: '#8b5cf6', bg: '#F5F3FF', description: 'Compliance, contracts, tax' },
  { id: 'people', name: 'NOVA People', role: 'CPO', color: '#f43f5e', bg: '#FFF1F2', description: 'HR, payroll, hiring, culture' },
  { id: 'tech', name: 'NOVA Tech', role: 'CTO', color: '#06b6d4', bg: '#ECFEFF', description: 'Integrations, automations, AI' },
]

const SUGGESTED: Record<string, string[]> = {
  cos: ['What needs my attention today?', 'Give me a business health check', 'Top 3 priorities this week?'],
  finance: ['How is our cash flow?', 'Which invoices are overdue?', 'What is our runway?'],
  ops: ['What items are low stock?', 'How many orders pending?', 'Optimize our procurement'],
  growth: ['Draft a campaign for this week', 'How to increase retention?', 'Analyze our marketing'],
  sales: ['Which deals need follow-up?', 'Score my pipeline', 'How to close the biggest deal?'],
  legal: ['What compliance deadlines?', 'Review contractor agreements', 'What tax filings are due?'],
  people: ['Upcoming performance reviews?', 'Draft a job description', 'What is payroll this month?'],
  tech: ['What integrations are connected?', 'Set up invoice automation', 'How can AI improve operations?'],
}

const WELCOME: Record<string, string> = {
  cos: 'Good day. I am NOVA CoS, your Chief of Staff. I have a full view across all departments. What would you like to focus on today?',
  finance: 'Hello. I am NOVA Finance, your CFO. I am monitoring your books and cash position. What financial question can I help with?',
  ops: 'Hi there. I am NOVA Ops, your COO. Tracking inventory, orders, and operations. What operational challenge can I help solve?',
  growth: 'Hey! I am NOVA Growth, your CMO. Ready to build campaigns and grow revenue. What marketing initiative should we tackle?',
  sales: 'Let us talk revenue. I am NOVA Sales, your CRO. Watching your pipeline. What deals should we focus on?',
  legal: 'Good day. I am NOVA Legal, your General Counsel. I keep your business compliant. What legal question can I help with?',
  people: 'Hi! I am NOVA People, your CPO. Here to help with HR, payroll, and your team. What can I assist with?',
  tech: 'Hello. I am NOVA Tech, your CTO. I manage integrations and AI. What technical challenge can I help solve?',
}

interface Message { role: 'user' | 'assistant'; content: string }

function getIcon(id: string) {
  const icons: Record<string, any> = { cos: Star, finance: TrendingUp, ops: Package, growth: Megaphone, sales: Users, legal: Scale, people: Heart, tech: Cpu }
  return icons[id] || Star
}

export default function NOVAIntelligenceModule() {
  const [activeExec, setActiveExec] = useState(EXECUTIVES[0])
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME.cos }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const Icon = getIcon(activeExec.id)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function switchExec(exec: typeof EXECUTIVES[0]) {
    setActiveExec(exec)
    setMessages([{ role: 'assistant', content: WELCOME[exec.id] || 'Hello! How can I help?' }])
    setInput('')
  }

  async function send(content: string) {
    if (!content.trim() || loading) return
    const newMsgs: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/nova', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executive: activeExec.id, messages: newMsgs }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'I encountered an error. Please try again.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', fontFamily: 'system-ui, sans-serif', background: '#f8f8f6' }}>
      <div style={{ width: 220, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={15} color="#6366f1" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>NOVA Executives</span>
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Your AI leadership team</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {EXECUTIVES.map(exec => {
            const ExIcon = getIcon(exec.id)
            const isActive = activeExec.id === exec.id
            return (
              <button key={exec.id} onClick={() => switchExec(exec)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none', background: isActive ? exec.bg : 'transparent', cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: isActive ? exec.color : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ExIcon size={14} color={isActive ? 'white' : '#6b7280'} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? exec.color : '#374151' }}>{exec.name}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{exec.role}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: activeExec.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{activeExec.name}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{activeExec.role} · {activeExec.description}</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: activeExec.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color="white" />
                </div>
              )}
              <div style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px', background: msg.role === 'user' ? '#111' : 'white', color: msg.role === 'user' ? 'white' : '#111', fontSize: 13, lineHeight: 1.6, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: activeExec.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color="white" />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '4px 14px 14px 14px', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <Loader2 size={15} color={activeExec.color} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {messages.length <= 1 && (
          <div style={{ padding: '0 20px 10px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(SUGGESTED[activeExec.id] || []).map((p, i) => (
              <button key={i} onClick={() => send(p)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #e5e7eb', background: 'white', fontSize: 12, color: '#374151', cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        )}
        <div style={{ padding: '10px 20px 18px', background: 'white', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: '#f9fafb', borderRadius: 10, padding: '8px 12px', border: '1px solid #e5e7eb' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }} placeholder={'Message ' + activeExec.name + '...'} rows={1} style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', outline: 'none', fontSize: 13, color: '#111', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }} />
            <button onClick={() => send(input)} disabled={!input.trim() || loading} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: !input.trim() || loading ? '#e5e7eb' : activeExec.color, color: 'white', cursor: !input.trim() || loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={13} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5, textAlign: 'center' }}>Enter to send · Shift+Enter for new line · Actions require your approval</p>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
