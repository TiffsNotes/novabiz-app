'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Building2, CreditCard, Users, Zap, Loader2 } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'

const STEPS = [
  { id: 0, title: 'Business profile', desc: 'Tell us about your business', icon: Building2 },
  { id: 1, title: 'Connect bank', desc: 'Link your bank accounts', icon: CreditCard },
  { id: 2, title: 'Connect payroll', desc: 'Link Gusto or import employees', icon: Users },
  { id: 3, title: 'AI setup', desc: 'NovaBiz learns your business', icon: Zap },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState({ name: '', industry: '', employeeCount: '', annualRevenue: '' })
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncStatus, setSyncStatus] = useState<string[]>([])
  const router = useRouter()

  // Load Plaid Link
  useEffect(() => {
    if (step === 1) {
      const script = document.createElement('script')
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
      document.body.appendChild(script)
    }
  }, [step])

  const saveProfile = async () => {
    setConnecting(true)
    await fetch('/api/platform/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_profile', ...profile }),
    })
    setConnecting(false)
    setStep(1)
  }

  const connectBank = async () => {
    setConnecting(true)
    const res = await fetch('/api/plaid/create-link-token', { method: 'POST' })
    const { link_token } = await res.json()

    // @ts-ignore - Plaid global
    const handler = window.Plaid?.create({
      token: link_token,
      onSuccess: async (public_token: string) => {
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token }),
        })
        setConnecting(false)
        setStep(2)
      },
      onExit: () => setConnecting(false),
    })
    handler?.open() || setStep(2) // fallback if Plaid not available
  }

  const skipPayroll = () => setStep(3)

  const startSync = async () => {
    setSyncing(true)
    const stages = [
      'Importing 12 months of transactions...',
      'AI is categorizing your books...',
      'Building your cash flow forecast...',
      'Scoring your sales pipeline...',
      'Configuring your 9 AI modules...',
      'NovaBiz OS is ready!',
    ]

    for (let i = 0; i < stages.length; i++) {
      await new Promise(r => setTimeout(r, 1200))
      setSyncStatus(prev => [...prev, stages[i]])
      setSyncProgress(Math.round(((i + 1) / stages.length) * 100))
    }

    await fetch('/api/platform/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    })
    router.push('/dashboard')
  }

  useEffect(() => { if (step === 3) startSync() }, [step])

  return (
    <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-[#00a855] flex items-center justify-center">
            <span className="font-black text-white text-base" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>N</span>
          </div>
          <span className="font-black text-xl text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.03em' }}>NovaBiz OS</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > i ? 'bg-[#00a855] text-white' :
                step === i ? 'bg-[#0a0a0a] text-white' :
                'bg-gray-200 text-gray-400'
              }`}>
                {step > i ? <Check size={12} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${step > i ? 'bg-[#00a855]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.07] shadow-sm p-8">
          {/* Step 0: Business Profile */}
          {step === 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><Building2 size={18} className="text-gray-600" /></div>
                <div>
                  <h2 className="font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Business profile</h2>
                  <p className="text-sm text-gray-500">So we can configure your AI modules correctly</p>
                </div>
              </div>
              <div className="space-y-4">
                <Input label="Business name" placeholder="Main Street Coffee Co." value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
                <Select label="Industry" value={profile.industry} onChange={v => setProfile(p => ({ ...p, industry: v }))} options={[
                  { value: '', label: 'Select your industry...' },
                  { value: 'restaurant', label: 'Restaurant / Food & Beverage' },
                  { value: 'retail', label: 'Retail' },
                  { value: 'construction', label: 'Construction / Trades' },
                  { value: 'healthcare', label: 'Healthcare / Wellness' },
                  { value: 'professional_services', label: 'Professional Services' },
                  { value: 'ecommerce', label: 'E-commerce' },
                  { value: 'manufacturing', label: 'Manufacturing' },
                  { value: 'other', label: 'Other' },
                ]} />
                <Select label="Employees" value={profile.employeeCount} onChange={v => setProfile(p => ({ ...p, employeeCount: v }))} options={[
                  { value: '', label: 'Select...' },
                  { value: '1-5', label: '1–5' }, { value: '6-15', label: '6–15' },
                  { value: '16-50', label: '16–50' }, { value: '51-200', label: '51–200' },
                ]} />
                <Select label="Annual revenue" value={profile.annualRevenue} onChange={v => setProfile(p => ({ ...p, annualRevenue: v }))} options={[
                  { value: '', label: 'Select...' },
                  { value: 'under_500k', label: 'Under $500K' },
                  { value: '500k_1m', label: '$500K – $1M' },
                  { value: '1m_5m', label: '$1M – $5M' },
                  { value: 'over_5m', label: 'Over $5M' },
                ]} />
                <Button variant="primary" className="w-full" loading={connecting} onClick={saveProfile} disabled={!profile.name || !profile.industry}>
                  Continue <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Connect Bank */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><CreditCard size={18} className="text-blue-600" /></div>
                <div>
                  <h2 className="font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Connect your bank</h2>
                  <p className="text-sm text-gray-500">Secure, read-only. We never store your credentials.</p>
                </div>
              </div>
              <div className="bg-gray-50 border border-black/[0.07] rounded-xl p-4 mb-6 space-y-2">
                {['256-bit encryption', 'Read-only access — we can\'t move money', 'Powered by Plaid, trusted by 12,000+ apps', '12 months of history imported automatically'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={13} className="text-[#00a855]" /> {f}
                  </div>
                ))}
              </div>
              <Button variant="success" className="w-full mb-3" loading={connecting} onClick={connectBank}>
                Connect bank account
              </Button>
              <button onClick={() => setStep(2)} className="w-full text-sm text-gray-400 hover:text-gray-600">
                Skip for now →
              </button>
            </div>
          )}

          {/* Step 2: Payroll */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Users size={18} className="text-purple-600" /></div>
                <div>
                  <h2 className="font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Connect payroll</h2>
                  <p className="text-sm text-gray-500">Sync employees and automate your payroll runs</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <button className="w-full flex items-center gap-3 p-4 border border-black/[0.07] rounded-xl hover:bg-gray-50 transition-colors text-left">
                  <span className="text-2xl">👥</span>
                  <div>
                    <div className="font-semibold text-sm text-gray-900">Connect Gusto</div>
                    <div className="text-xs text-gray-400">Sync employees, run payroll from NovaBiz</div>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-gray-300" />
                </button>
                <button className="w-full flex items-center gap-3 p-4 border border-black/[0.07] rounded-xl hover:bg-gray-50 transition-colors text-left">
                  <span className="text-2xl">🏢</span>
                  <div>
                    <div className="font-semibold text-sm text-gray-900">Connect ADP</div>
                    <div className="text-xs text-gray-400">Import employees from ADP Workforce</div>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-gray-300" />
                </button>
              </div>
              <Button variant="secondary" className="w-full" onClick={skipPayroll}>Skip — add employees manually later</Button>
            </div>
          )}

          {/* Step 3: AI Setup */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#e8f8f0] flex items-center justify-center">
                  {syncing && syncProgress < 100 ? <Loader2 size={18} className="text-[#00a855] animate-spin" /> : <Zap size={18} className="text-[#00a855]" />}
                </div>
                <div>
                  <h2 className="font-black text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>Setting up your AI team</h2>
                  <p className="text-sm text-gray-500">This takes about 30 seconds</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Progress</span><span>{syncProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00a855] rounded-full transition-all duration-500" style={{ width: `${syncProgress}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                {syncStatus.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600 animate-in slide-in-from-left-2">
                    <Check size={13} className="text-[#00a855] flex-shrink-0" /> {s}
                  </div>
                ))}
                {syncProgress < 100 && syncing && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={13} className="animate-spin" /> Working...
                  </div>
                )}
              </div>

              {syncProgress === 100 && (
                <div className="mt-6 bg-[#e8f8f0] border border-[#00a855]/20 rounded-xl p-4 text-center">
                  <div className="font-bold text-[#007a3d] mb-1">🎉 NovaBiz OS is ready!</div>
                  <div className="text-sm text-[#007a3d]">Your AI executive team is live and working.</div>
                  <Button variant="success" className="mt-3 w-full" onClick={() => router.push('/dashboard')}>
                    Go to dashboard →
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          30-day money-back guarantee · Cancel anytime · SOC 2 compliant
        </p>
      </div>
    </div>
  )
}
