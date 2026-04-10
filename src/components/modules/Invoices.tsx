'use client'
import { useState, useEffect } from 'react'
import { Plus, Send, CheckCircle, AlertTriangle, Download } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, Modal, Input, EmptyState } from '@/components/ui'

type Invoice = { id: string; number: string; client: string; amount: number; amountDue: number; status: string; issueDate: string; dueDate?: string; currency: string }
type Bill = { id: string; number: string; vendor: string; amount: number; amountPaid: number; status: string; billDate: string; dueDate?: string }
type ARStats = { totalAR: number; overdue: number; dueThisWeek: number; paidThisMonth: number }
type APStats = { totalAP: number; overdue: number; dueThisWeek: number; paidThisMonth: number }
type LineItem = { description: string; qty: string; rate: string }

const fmt = (c: number) => `$${(c / 100).toLocaleString()}`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const isOverdue = (d?: string) => d ? new Date(d) < new Date() : false

const defaultForm = {
  client: '',
  email: '',
  number: '',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  notes: '',
}

export default function InvoicesModule() {
  const [tab, setTab] = useState('ar')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [arStats, setARStats] = useState<ARStats | null>(null)
  const [apStats, setAPStats] = useState<APStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [newInvoice, setNewInvoice] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', qty: '1', rate: '' }])
  const [submitting, setSubmitting] = useState(false)

  const setField = (k: keyof typeof defaultForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const setLineField = (i: number, k: keyof LineItem) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLineItems(items => items.map((item, idx) => idx === i ? { ...item, [k]: e.target.value } : item))

  const addLineItem = () => setLineItems(items => [...items, { description: '', qty: '1', rate: '' }])

  const lineTotal = (item: LineItem) => (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)

  const invoiceTotal = lineItems.reduce((s, item) => s + lineTotal(item), 0)

  const resetForm = () => {
    setForm(defaultForm)
    setLineItems([{ description: '', qty: '1', rate: '' }])
    setNewInvoice(false)
  }

  const handleSubmit = async (send: boolean) => {
  setSubmitting(true)
  try {
    const payload = {
      action: 'create_invoice',
      customerName: form.client,
      customerEmail: form.email,
      dueDate: form.dueDate,
      notes: form.notes,
      lineItems: lineItems
        .filter(i => i.description || i.rate)
        .map(i => ({
          description: i.description,
          quantity: parseFloat(i.qty) || 1,
          unitPrice: parseFloat(i.rate) || 0,
        })),
    }
    const res = await fetch('/api/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const created = await res.json()
      setInvoices(prev => [created.invoice, ...prev])
      resetForm()
    } else {
      alert('Failed to save invoice. Please try again.')
    }
  } catch {
    alert('Network error. Please try again.')
  } finally {
    setSubmitting(false)
  }
}
  useEffect(() => {
    Promise.all([
      fetch('/api/finance?view=invoices').then(r => r.ok ? r.json() : { invoices: [] }),
      fetch('/api/finance?view=bills').then(r => r.ok ? r.json() : { bills: [] }),
      fetch('/api/finance?view=ar_stats').then(r => r.ok ? r.json() : {}),
      fetch('/api/finance?view=ap_stats').then(r => r.ok ? r.json() : {}),
    ]).then(([inv, bil, ar, ap]) => {
      setInvoices(inv.invoices || [])
      setBills(bil.bills || [])
      setARStats(ar)
      setAPStats(ap)
      setLoading(false)
    })
  }, [])

  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE' || (i.status !== 'PAID' && i.status !== 'VOID' && isOverdue(i.dueDate)))
  const overdueBills = bills.filter(b => b.status !== 'paid' && isOverdue(b.dueDate))

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Invoices & Bills"
        subtitle="Accounts receivable, accounts payable, and payment tracking"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">New Bill</Button>
            <Button size="sm" icon={Plus} onClick={() => setNewInvoice(true)}>New Invoice</Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-3 p-4 border-b border-black/[0.07] bg-gray-50">
        <StatCard label="Accounts Receivable" value={arStats ? fmt(arStats.totalAR) : '—'} sub="total outstanding" color="#2563eb" />
        <StatCard label="Overdue Invoices" value={arStats ? fmt(arStats.overdue) : '—'} sub={`${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? 's' : ''}`} color="#dc2626" icon={AlertTriangle} />
        <StatCard label="Accounts Payable" value={apStats ? fmt(apStats.totalAP) : '—'} sub="bills to pay" color="#d97706" />
        <StatCard label="Collected This Month" value={arStats ? fmt(arStats.paidThisMonth) : '—'} color="#00a855" icon={CheckCircle} />
      </div>

      {overdueInvoices.length > 0 && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center gap-3">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">
            <strong>{overdueInvoices.length} overdue invoice{overdueInvoices.length !== 1 ? 's' : ''}</strong> totaling {fmt(overdueInvoices.reduce((s, i) => s + i.amountDue, 0))} — AI can send reminders automatically.
          </span>
          <Button size="xs" variant="danger" className="ml-auto flex-shrink-0">Send Reminders</Button>
        </div>
      )}

      <Tabs tabs={[
        { key: 'ar', label: 'Invoices (AR)', count: invoices.filter(i => i.status !== 'PAID' && i.status !== 'VOID').length },
        { key: 'ap', label: 'Bills (AP)', count: bills.filter(b => b.status !== 'paid').length },
        { key: 'aging', label: 'AR Aging' },
      ]} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-auto p-4">
        {tab === 'ar' && (
          <Card padding={false}>
            <Table<Invoice>
              columns={[
                { key: 'number', header: 'Invoice #', render: r => <span className="font-mono text-sm font-medium text-gray-700">{r.number}</span> },
                { key: 'client', header: 'Client', render: r => <span className="font-medium text-gray-900">{r.client}</span> },
                { key: 'amount', header: 'Amount', render: r => <span className="font-semibold tabular-nums">{fmt(r.amount)}</span> },
                { key: 'amountDue', header: 'Balance Due', render: r => (
                  <span className={`font-bold tabular-nums ${r.amountDue > 0 ? 'text-red-600' : 'text-[#00a855]'}`}>
                    {fmt(r.amountDue)}
                  </span>
                )},
                { key: 'issueDate', header: 'Issued', render: r => <span className="text-sm text-gray-500">{fmtDate(r.issueDate)}</span> },
                { key: 'dueDate', header: 'Due', render: r => (
                  <span className={`text-sm ${isOverdue(r.dueDate) && r.status !== 'PAID' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {fmtDate(r.dueDate)}
                    {isOverdue(r.dueDate) && r.status !== 'PAID' && ' ⚠'}
                  </span>
                )},
                { key: 'status', header: 'Status', render: r => (
                  <Badge variant={r.status === 'PAID' ? 'green' : r.status === 'OVERDUE' ? 'red' : r.status === 'SENT' ? 'blue' : r.status === 'PARTIAL' ? 'yellow' : 'gray'}>
                    {r.status.toLowerCase()}
                  </Badge>
                )},
                { key: 'actions', header: '', render: r => r.status !== 'PAID' && r.status !== 'VOID' ? (
                  <div className="flex gap-1">
                    {r.status === 'DRAFT' && <Button size="xs" variant="secondary" icon={Send}>Send</Button>}
                    {r.status !== 'DRAFT' && <Button size="xs" variant="secondary" icon={CheckCircle}>Record Payment</Button>}
                    <Button size="xs" variant="ghost" icon={Download} />
                  </div>
                ) : null },
              ]}
              data={invoices}
              emptyMessage="No invoices yet. Create your first invoice to start tracking payments."
            />
          </Card>
        )}

        {tab === 'ap' && (
          <Card padding={false}>
            <Table<Bill>
              columns={[
                { key: 'number', header: 'Bill #', render: r => <span className="font-mono text-sm">{r.number}</span> },
                { key: 'vendor', header: 'Vendor', render: r => <span className="font-medium text-gray-900">{r.vendor}</span> },
                { key: 'amount', header: 'Amount', render: r => <span className="font-semibold tabular-nums">{fmt(r.amount)}</span> },
                { key: 'amountPaid', header: 'Paid', render: r => <span className="tabular-nums text-gray-600">{fmt(r.amountPaid)}</span> },
                { key: 'billDate', header: 'Date', render: r => <span className="text-sm text-gray-500">{fmtDate(r.billDate)}</span> },
                { key: 'dueDate', header: 'Due', render: r => (
                  <span className={`text-sm ${isOverdue(r.dueDate) && r.status !== 'paid' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {fmtDate(r.dueDate)}
                  </span>
                )},
                { key: 'status', header: 'Status', render: r => (
                  <Badge variant={r.status === 'paid' ? 'green' : r.status === 'approved' ? 'blue' : 'gray'}>
                    {r.status}
                  </Badge>
                )},
              ]}
              data={bills}
              emptyMessage="No bills yet."
            />
          </Card>
        )}

        {tab === 'aging' && (
          <Card>
            <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>AR Aging Summary</h3>
            <div className="grid grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Current', days: '0 days', color: '#00a855', value: invoices.filter(i => !isOverdue(i.dueDate) && i.status !== 'PAID').reduce((s, i) => s + i.amountDue, 0) },
                { label: '1–30 days', days: 'overdue', color: '#d97706', value: overdueInvoices.filter(i => { const d = new Date(i.dueDate || ''); return Math.floor((Date.now() - d.getTime()) / 86400000) <= 30 }).reduce((s, i) => s + i.amountDue, 0) },
                { label: '31–60 days', days: 'overdue', color: '#ef4444', value: overdueInvoices.filter(i => { const d = new Date(i.dueDate || ''); const age = Math.floor((Date.now() - d.getTime()) / 86400000); return age > 30 && age <= 60 }).reduce((s, i) => s + i.amountDue, 0) },
                { label: '61–90 days', days: 'overdue', color: '#dc2626', value: overdueInvoices.filter(i => { const d = new Date(i.dueDate || ''); const age = Math.floor((Date.now() - d.getTime()) / 86400000); return age > 60 && age <= 90 }).reduce((s, i) => s + i.amountDue, 0) },
                { label: '90+ days', days: 'overdue', color: '#991b1b', value: overdueInvoices.filter(i => { const d = new Date(i.dueDate || ''); return Math.floor((Date.now() - d.getTime()) / 86400000) > 90 }).reduce((s, i) => s + i.amountDue, 0) },
              ].map(bucket => (
                <div key={bucket.label} className="text-center p-4 rounded-xl bg-gray-50 border border-black/[0.07]">
                  <div className="text-xs text-gray-400 mb-1">{bucket.label}</div>
                  <div className="text-xs text-gray-400 mb-2">{bucket.days}</div>
                  <div className="font-black text-lg" style={{ color: bucket.value > 0 ? bucket.color : '#9ca3af', fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                    {fmt(bucket.value)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal open={newInvoice} onClose={resetForm} title="New Invoice" width="max-w-2xl">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Client name" placeholder="Acme Corp" value={form.client} onChange={setField('client')} />
            <Input label="Client email" type="email" placeholder="billing@acme.com" value={form.email} onChange={setField('email')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Invoice #" placeholder="INV-0001" value={form.number} onChange={setField('number')} />
            <Input label="Issue date" type="date" value={form.issueDate} onChange={setField('issueDate')} />
            <Input label="Due date" type="date" value={form.dueDate} onChange={setField('dueDate')} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Line Items</div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-2">
                <span className="col-span-6">Description</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-2">Rate</span>
                <span className="col-span-2">Amount</span>
              </div>
              {lineItems.map((item, i) => (
  <div key={i} className="grid grid-cols-12 gap-2">
    <Input className="col-span-6" placeholder="Service description" value={item.description} onChange={setLineField(i, 'description')} />
    <Input className="col-span-2" type="number" value={item.qty} onChange={setLineField(i, 'qty')} />
    <Input className="col-span-2" type="number" placeholder="0.00" value={item.rate} onChange={setLineField(i, 'rate')} />
    <div className="col-span-2 flex items-center justify-center text-sm font-semibold text-gray-700">
      ${lineTotal(item).toFixed(2)}
    </div>
  </div>
))}
            </div>
            <Button size="xs" variant="ghost" className="mt-2" onClick={addLineItem}>+ Add line item</Button>
          </div>
          <div className="flex justify-end text-sm font-bold text-gray-800 pr-1">
            Total: ${invoiceTotal.toFixed(2)}
          </div>
          <Input label="Notes / payment terms" placeholder="Payment due within 30 days" value={form.notes} onChange={setField('notes')} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => handleSubmit(false)} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save as Draft'}
            </Button>
            <Button variant="success" className="flex-1" icon={Send} onClick={() => handleSubmit(true)} disabled={submitting}>
              {submitting ? 'Sending…' : 'Save & Send'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
