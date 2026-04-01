'use client'
import { useState, useEffect } from 'react'
import { Users, Plus, Phone, Mail, Building2, Star, TrendingUp, MessageSquare, ArrowUpRight } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, EmptyState, Modal, Input } from '@/components/ui'

type Contact = { id: string; firstName: string; lastName?: string; email?: string; phone?: string; title?: string; company?: string; stage: string; score?: number; createdAt: string }
type Deal = { id: string; name: string; value?: number; stage: string; probability: number; contact?: string; company?: string; expectedClose?: string; aiScore?: number; aiInsights?: string }
type Ticket = { id: string; number: string; subject: string; status: string; priority: string; contact?: string; createdAt: string }
type Stats = { totalContacts: number; totalDeals: number; pipelineValue: number; weightedPipeline: number; wonThisMonth: number; newContacts: number }

const DEAL_STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const STAGE_COLORS: Record<string, string> = { prospect: '#6b7280', qualified: '#2563eb', proposal: '#7c3aed', negotiation: '#d97706', closed_won: '#00a855', closed_lost: '#dc2626' }

const fmt = (c: number) => `$${(c/100).toLocaleString()}`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

export default function CRMModule() {
  const [tab, setTab] = useState('pipeline')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [newContact, setNewContact] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/crm?view=contacts').then(r => r.ok ? r.json() : { contacts: [], total: 0 }),
      fetch('/api/crm?view=deals').then(r => r.ok ? r.json() : { deals: [] }),
      fetch('/api/crm?view=tickets').then(r => r.ok ? r.json() : { tickets: [] }),
      fetch('/api/crm?view=stats').then(r => r.ok ? r.json() : {}),
    ]).then(([c, d, t, s]) => {
      setContacts(c.contacts || []); setDeals(d.deals || [])
      setTickets(t.tickets || []); setStats(s)
      setLoading(false)
    })
  }, [])

  const stageDeals = (stage: string) => deals.filter(d => d.stage === stage)

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="CRM & SalesFlow"
        subtitle="Manage contacts, pipeline, and customer relationships with AI-powered insights"
        actions={<Button icon={Plus} size="sm" onClick={() => setNewContact(true)}>Add Contact</Button>}
      />

      {stats && (
        <div className="grid grid-cols-5 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
          <StatCard label="Total Contacts" value={stats.totalContacts.toLocaleString()} color="#2563eb" />
          <StatCard label="Open Deals" value={stats.totalDeals.toString()} color="#7c3aed" />
          <StatCard label="Pipeline Value" value={fmt(stats.pipelineValue)} color="#0891b2" />
          <StatCard label="Weighted Pipeline" value={fmt(stats.weightedPipeline)} color="#7c3aed" />
          <StatCard label="Won This Month" value={fmt(stats.wonThisMonth)} color="#00a855" />
        </div>
      )}

      <Tabs tabs={[
        { key: 'pipeline', label: 'Pipeline' },
        { key: 'contacts', label: 'Contacts', count: contacts.length },
        { key: 'tickets', label: 'Support Tickets', count: tickets.filter(t => t.status !== 'closed').length },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto">
        {/* PIPELINE KANBAN */}
        {tab === 'pipeline' && (
          <div className="p-4 flex gap-3 overflow-x-auto min-h-full">
            {DEAL_STAGES.slice(0, 5).map(stage => (
              <div key={stage} className="w-64 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stage.replace('_', ' ')}</span>
                  <span className="ml-auto text-xs text-gray-400">{stageDeals(stage).length}</span>
                </div>
                <div className="space-y-2">
                  {stageDeals(stage).map(deal => (
                    <div key={deal.id} className="bg-white border border-black/[0.07] rounded-xl p-3 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="font-medium text-sm text-gray-900 mb-1">{deal.name}</div>
                      {deal.value && <div className="font-bold text-sm" style={{ color: STAGE_COLORS[stage] }}>{fmt(deal.value)}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        {deal.company && <span className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={9}/>{deal.company}</span>}
                        <span className="ml-auto text-xs text-gray-400">{deal.probability}%</span>
                      </div>
                      {deal.aiInsights && (
                        <div className="mt-2 text-xs text-[#007a3d] bg-[#e8f8f0] rounded-lg p-2 leading-relaxed">{deal.aiInsights.substring(0, 100)}...</div>
                      )}
                      {deal.expectedClose && <div className="text-xs text-gray-400 mt-1">Close: {fmtDate(deal.expectedClose)}</div>}
                    </div>
                  ))}
                  {stageDeals(stage).length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">No deals</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONTACTS */}
        {tab === 'contacts' && (
          <div className="p-4">
            <Card padding={false}>
              <Table<Contact>
                columns={[
                  { key: 'name', header: 'Name', render: r => (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {r.firstName[0]}{r.lastName?.[0] || ''}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{r.firstName} {r.lastName}</div>
                        {r.title && <div className="text-xs text-gray-400">{r.title}</div>}
                      </div>
                    </div>
                  )},
                  { key: 'company', header: 'Company', render: r => r.company ? <span className="flex items-center gap-1 text-sm text-gray-600"><Building2 size={12}/>{r.company}</span> : <span className="text-gray-300">—</span> },
                  { key: 'email', header: 'Contact', render: r => (
                    <div className="space-y-0.5">
                      {r.email && <div className="flex items-center gap-1 text-xs text-gray-500"><Mail size={10}/>{r.email}</div>}
                      {r.phone && <div className="flex items-center gap-1 text-xs text-gray-500"><Phone size={10}/>{r.phone}</div>}
                    </div>
                  )},
                  { key: 'stage', header: 'Stage', render: r => <Badge variant={r.stage === 'customer' ? 'green' : 'blue'}>{r.stage}</Badge> },
                  { key: 'score', header: 'AI Score', render: r => r.score ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#00a855]" style={{ width: `${r.score}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{r.score}</span>
                    </div>
                  ) : <span className="text-gray-300 text-xs">—</span> },
                  { key: 'createdAt', header: 'Added', render: r => <span className="text-xs text-gray-400">{fmtDate(r.createdAt)}</span> },
                ]}
                data={contacts}
                emptyMessage="No contacts yet. Import a CSV or add your first contact."
              />
            </Card>
          </div>
        )}

        {/* SUPPORT TICKETS */}
        {tab === 'tickets' && (
          <div className="p-4">
            <Card padding={false}>
              <Table<Ticket>
                columns={[
                  { key: 'number', header: '#', render: r => <span className="text-xs font-mono text-gray-400">{r.number}</span> },
                  { key: 'subject', header: 'Subject', render: r => <span className="font-medium text-sm text-gray-800">{r.subject}</span> },
                  { key: 'contact', header: 'Contact', render: r => <span className="text-sm text-gray-500">{r.contact || '—'}</span> },
                  { key: 'priority', header: 'Priority', render: r => (
                    <Badge variant={r.priority === 'urgent' ? 'red' : r.priority === 'high' ? 'yellow' : 'default'}>{r.priority}</Badge>
                  )},
                  { key: 'status', header: 'Status', render: r => (
                    <Badge variant={r.status === 'resolved' ? 'green' : r.status === 'in_progress' ? 'blue' : 'default'}>{r.status.replace('_', ' ')}</Badge>
                  )},
                  { key: 'createdAt', header: 'Opened', render: r => <span className="text-xs text-gray-400">{fmtDate(r.createdAt)}</span> },
                ]}
                data={tickets}
                emptyMessage="No support tickets."
              />
            </Card>
          </div>
        )}
      </div>

      {/* New Contact Modal */}
      <Modal open={newContact} onClose={() => setNewContact(false)} title="Add Contact">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" placeholder="Sarah" />
            <Input label="Last name" placeholder="Johnson" />
          </div>
          <Input label="Email" type="email" placeholder="sarah@company.com" />
          <Input label="Phone" type="tel" placeholder="+1 (555) 000-0000" />
          <Input label="Company" placeholder="Acme Corp" />
          <Input label="Title / Role" placeholder="CEO" />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setNewContact(false)}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={() => setNewContact(false)}>Save Contact</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
