'use client'
import { useState } from 'react'
import { Save, Users, CreditCard } from 'lucide-react'
import { PageHeader, Card, Tabs, Button, Input, Select, Badge } from '@/components/ui'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function SettingsPage() {
  const [tab, setTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [thresholds, setThresholds] = useState({ transaction: '500', vendor_new: '1000', payroll: '0', po: '2000' })

  const save = async () => { setSaving(true); await new Promise(r => setTimeout(r, 800)); setSaving(false) }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <PageHeader title="Settings" subtitle="Business profile, AI thresholds, team access, and billing"
          actions={<Button icon={Save} size="sm" variant="success" loading={saving} onClick={save}>Save Changes</Button>} />
        <Tabs tabs={[
          { key: 'profile', label: 'Business Profile' }, { key: 'thresholds', label: 'AI Thresholds' },
          { key: 'team', label: 'Team & Permissions' }, { key: 'billing', label: 'Plan & Billing' },
        ]} active={tab} onChange={setTab} />
        <div className="flex-1 overflow-auto p-4">
          {tab === 'profile' && (
            <div className="max-w-2xl space-y-4">
              <Card>
                <h3 className="font-bold text-gray-900 mb-4">Business Information</h3>
                <div className="space-y-3">
                  <Input label="Business name" placeholder="Main Street Coffee Co." />
                  <Input label="Legal name" placeholder="Main Street Coffee LLC" />
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Industry" value="" onChange={() => {}} options={[
                      { value: '', label: 'Select...' }, { value: 'restaurant', label: 'Restaurant' },
                      { value: 'retail', label: 'Retail' }, { value: 'construction', label: 'Construction' },
                    ]} />
                    <Select label="Base currency" value="USD" onChange={() => {}} options={[
                      { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
                    ]} />
                  </div>
                  <Input label="Tax ID / EIN" placeholder="12-3456789" />
                </div>
              </Card>
            </div>
          )}
          {tab === 'thresholds' && (
            <div className="max-w-2xl space-y-4">
              <Card>
                <h3 className="font-bold text-gray-900 mb-1">AI Approval Thresholds</h3>
                <p className="text-sm text-gray-500 mb-5">Actions below these thresholds execute automatically. Above — they go to CommandInbox for your approval.</p>
                <div className="space-y-3">
                  {[
                    { key: 'transaction', label: 'Transaction auto-approve', desc: 'Auto-categorize transactions below this amount' },
                    { key: 'vendor_new', label: 'New vendor payment', desc: 'Flag new vendors for approval up to this amount' },
                    { key: 'po', label: 'Purchase order', desc: 'AI-generated POs below this are sent automatically' },
                    { key: 'payroll', label: 'Payroll runs', desc: 'Set to $0 to always require approval' },
                  ].map(f => (
                    <div key={f.key} className="flex items-start gap-4 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{f.label}</div>
                        <div className="text-xs text-gray-400">{f.desc}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-sm">$</span>
                        <input type="number" value={thresholds[f.key as keyof typeof thresholds]}
                          onChange={e => setThresholds(p => ({ ...p, [f.key]: e.target.value }))}
                          className="w-24 border border-black/[0.08] rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#0a0a0a]" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {tab === 'team' && (
            <div className="max-w-2xl">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Team Members</h3>
                  <Button size="sm" icon={Users}>Invite Member</Button>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600">Y</div>
                  <div className="flex-1"><div className="font-medium text-sm">You (Owner)</div><div className="text-xs text-gray-400">Full access to all modules</div></div>
                  <Badge variant="purple">OWNER</Badge>
                </div>
              </Card>
            </div>
          )}
          {tab === 'billing' && (
            <div className="max-w-2xl">
              <Card>
                <h3 className="font-bold text-gray-900 mb-4">Current Plan</h3>
                <div className="bg-[#0a0a0a] rounded-xl p-5 text-white mb-4">
                  <div className="flex justify-between items-center">
                    <div><div className="font-black text-xl">Pro Plan</div><div className="text-white/50 text-sm">All 9 modules</div></div>
                    <div className="text-right"><div className="font-black text-2xl text-[#00a855]">$499</div><div className="text-white/40 text-xs">/month</div></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">Update Payment</Button>
                  <Button variant="secondary" size="sm">Invoices</Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
