'use client'
import { useState, useEffect } from 'react'
import { Megaphone, Plus, Send, Calendar, Star, BarChart3, RefreshCw, Wand2, Instagram, Mail } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, Modal, Input, Select, EmptyState } from '@/components/ui'

type Campaign = { id: string; name: string; type: string; status: string; platforms: string[]; scheduledAt?: string; sentAt?: string; metrics?: Record<string, number>; aiGenerated: boolean }
type MarketingStats = { campaignsSent30Days: number; scheduledPosts: number; draftCampaigns: number }

const fmtDate = (d?: string) => { try { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' } catch { return '—' } }

const PLATFORM_ICONS: Record<string, string> = {
  email: '📧', instagram: '📸', facebook: '📘', twitter: '🐦', linkedin: '💼',
}

export default function GrowthEngineModule() {
  const [tab, setTab] = useState('campaigns')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState<MarketingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [newCampaign, setNewCampaign] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [campaignForm, setCampaignForm] = useState({ goal: '', audience: '', topic: '', type: 'email' })
  const [generatedContent, setGeneratedContent] = useState<Record<string, string> | null>(null)
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewResponse, setReviewResponse] = useState('')
  const [generatingResponse, setGeneratingResponse] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/marketing?view=campaigns').then(r => r.ok ? r.json() : { campaigns: [] }),
      fetch('/api/marketing?view=stats').then(r => r.ok ? r.json() : {}),
    ]).then(([c, s]) => {
      setCampaigns(c.campaigns || [])
      setStats(s)
      setLoading(false)
    })
  }, [])

  const generateCampaign = async () => {
    setGenerating(true)
    const res = await fetch('/api/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_campaign', ...campaignForm }),
    })
    if (res.ok) {
      const data = await res.json()
      setGeneratedContent(data.content)
    }
    setGenerating(false)
  }

  const generateSocialCalendar = async () => {
    setGenerating(true)
    const res = await fetch('/api/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_social_calendar', platforms: ['instagram', 'facebook'] }),
    })
    if (res.ok) {
      const data = await res.json()
      alert(`Generated ${data.count} social posts for the next 7 days! Check CommandInbox to review.`)
    }
    setGenerating(false)
  }

  const generateReviewResponse = async () => {
    setGeneratingResponse(true)
    const res = await fetch('/api/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_review_response', rating: reviewRating, text: reviewText, platform: 'Google' }),
    })
    if (res.ok) {
      const data = await res.json()
      setReviewResponse(data.response)
    }
    setGeneratingResponse(false)
  }

  const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled')
  const sentCampaigns = campaigns.filter(c => c.status === 'sent')

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="GrowthEngine"
        subtitle="AI-powered marketing — campaigns, social content, and reputation management"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Calendar} loading={generating} onClick={generateSocialCalendar}>
              Generate 7-Day Social
            </Button>
            <Button size="sm" icon={Plus} onClick={() => setNewCampaign(true)}>New Campaign</Button>
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-4 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
          <StatCard label="Campaigns Sent (30d)" value={stats.campaignsSent30Days.toString()} color="#d97706" />
          <StatCard label="Scheduled Posts" value={stats.scheduledPosts.toString()} color="#7c3aed" />
          <StatCard label="Drafts" value={stats.draftCampaigns.toString()} color="#6b7280" />
          <StatCard label="AI Generated" value={campaigns.filter(c => c.aiGenerated).length.toString()} sub="of all campaigns" color="#00a855" />
        </div>
      )}

      <Tabs tabs={[
        { key: 'campaigns', label: 'Campaigns', count: campaigns.length },
        { key: 'social', label: 'Social Calendar', count: scheduledCampaigns.length },
        { key: 'reviews', label: 'Review Responder' },
        { key: 'performance', label: 'Performance' },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {tab === 'campaigns' && (
          <Card padding={false}>
            <Table<Campaign>
              columns={[
                { key: 'name', header: 'Campaign', render: r => (
                  <div>
                    <div className="font-medium text-gray-900">{r.name}</div>
                    {r.aiGenerated && <span className="text-xs text-[#007a3d] bg-[#e8f8f0] px-1.5 py-0.5 rounded-md">AI Generated</span>}
                  </div>
                )},
                { key: 'type', header: 'Type', render: r => (
                  <div className="flex items-center gap-1.5">
                    <span>{PLATFORM_ICONS[r.type] || '📣'}</span>
                    <span className="text-sm capitalize">{r.type}</span>
                  </div>
                )},
                { key: 'platforms', header: 'Platforms', render: r => (
                  <div className="flex gap-1">{r.platforms.map(p => <span key={p} title={p}>{PLATFORM_ICONS[p] || '📣'}</span>)}</div>
                )},
                { key: 'scheduled', header: 'Date', render: r => (
                  <span className="text-sm text-gray-500">{r.sentAt ? fmtDate(r.sentAt) : r.scheduledAt ? fmtDate(r.scheduledAt) : '—'}</span>
                )},
                { key: 'status', header: 'Status', render: r => (
                  <Badge variant={r.status === 'sent' ? 'green' : r.status === 'scheduled' ? 'blue' : r.status === 'draft' ? 'gray' : 'yellow'}>
                    {r.status}
                  </Badge>
                )},
                { key: 'actions', header: '', render: r => r.status === 'draft' ? (
                  <div className="flex gap-1">
                    <Button size="xs" variant="secondary">Edit</Button>
                    <Button size="xs" variant="success" icon={Send}>Send</Button>
                  </div>
                ) : null },
              ]}
              data={campaigns}
              emptyMessage="No campaigns yet. Create your first AI-powered campaign."
            />
          </Card>
        )}

        {tab === 'social' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700">Upcoming Posts</h3>
              <Button size="sm" variant="secondary" loading={generating} onClick={generateSocialCalendar} icon={Wand2}>
                Regenerate Calendar
              </Button>
            </div>
            {scheduledCampaigns.length === 0 ? (
              <EmptyState
                icon={Instagram}
                title="No scheduled posts"
                description="Let GrowthEngine create 7 days of social content automatically."
                action={<Button size="sm" icon={Wand2} loading={generating} onClick={generateSocialCalendar}>Generate Now</Button>}
              />
            ) : (
              <div className="space-y-2">
                {scheduledCampaigns.map(post => (
                  <Card key={post.id}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{post.platforms.map(p => PLATFORM_ICONS[p]).join('')}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{post.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Scheduled: {fmtDate(post.scheduledAt)}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="xs" variant="secondary">Edit</Button>
                        <Button size="xs" variant="danger">Delete</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'reviews' && (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Review Response Generator</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Star Rating</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setReviewRating(n)}>
                        <Star size={20} className={n <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Review text</div>
                  <textarea
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    rows={4}
                    placeholder="Paste the customer review here..."
                    className="w-full border border-black/[0.08] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0a0a0a] resize-none"
                  />
                </div>
                <Button variant="success" icon={Wand2} loading={generatingResponse} onClick={generateReviewResponse} disabled={!reviewText}>
                  Generate Response
                </Button>
              </div>
            </Card>
            <Card>
              <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>AI Response</h3>
              {reviewResponse ? (
                <div className="space-y-3">
                  <div className="bg-[#f0fdf4] border border-[#00a855]/20 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                    {reviewResponse}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary">Copy</Button>
                    <Button size="sm" variant="ghost" onClick={() => setReviewResponse('')}>Clear</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-300 text-sm">
                  AI response will appear here
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === 'performance' && (
          <EmptyState icon={BarChart3} title="Campaign Analytics" description="Connect your email platform and social accounts to track opens, clicks, and conversions." action={<Button size="sm" variant="secondary">Connect Accounts</Button>} />
        )}
      </div>

      {/* New Campaign Modal */}
      <Modal open={newCampaign} onClose={() => { setNewCampaign(false); setGeneratedContent(null) }} title="Create AI Campaign" width="max-w-2xl">
        <div className="p-6 space-y-4">
          {!generatedContent ? (
            <>
              <Select label="Campaign type" value={campaignForm.type} onChange={v => setCampaignForm(p => ({ ...p, type: v }))} options={[
                { value: 'email', label: '📧 Email Campaign' },
                { value: 'instagram', label: '📸 Instagram Post' },
                { value: 'facebook', label: '📘 Facebook Post' },
              ]} />
              <Input label="Goal" placeholder="Re-engage inactive customers" value={campaignForm.goal} onChange={e => setCampaignForm(p => ({ ...p, goal: e.target.value }))} />
              <Input label="Target audience" placeholder="Customers who haven't ordered in 60+ days" value={campaignForm.audience} onChange={e => setCampaignForm(p => ({ ...p, audience: e.target.value }))} />
              <Input label="Product / topic (optional)" placeholder="New seasonal menu item" value={campaignForm.topic} onChange={e => setCampaignForm(p => ({ ...p, topic: e.target.value }))} />
              <Button variant="success" className="w-full" icon={Wand2} loading={generating} onClick={generateCampaign} disabled={!campaignForm.goal || !campaignForm.audience}>
                Generate with AI
              </Button>
            </>
          ) : (
            <>
              <div className="bg-[#e8f8f0] border border-[#00a855]/20 rounded-xl p-3 mb-2">
                <div className="text-xs font-semibold text-[#007a3d] mb-1">✓ AI Generated</div>
              </div>
              {generatedContent.subject && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Subject Line</div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm font-medium text-gray-800">{generatedContent.subject}</div>
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Body</div>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">{generatedContent.body}</div>
              </div>
              {generatedContent.cta && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">CTA</div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm font-medium text-[#00a855]">{generatedContent.cta}</div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setGeneratedContent(null)}>Regenerate</Button>
                <Button variant="success" className="flex-1" icon={Send}>Save to Drafts</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
