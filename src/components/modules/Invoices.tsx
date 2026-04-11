'use client'
import { useState, useEffect } from 'react'
import { Plus, Send, CheckCircle, AlertTriangle, Download, ExternalLink } from 'lucide-react'
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
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', qty: '1', rate: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [gettingPaymentLink, setGettingPaymentLink] = useState(false)

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

  const handleViewPDF = (invoice: Invoice) => {
    window.open('/api/invoices/' + invoice.id + '/pdf', '_blank')
  }

  const handleGetPaymentLink = async (invoice: Invoice) => {
    setGettingPaymentLink(true)
    try {
      const res = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        alert('Error: ' + (data.error || 'Could not create payment link'))
      }
    } catch {
      alert('Network error creating payment link')
    } finally {
      setGettingPaymentLink(false)
    }
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

  const handleMarkPaid = async (invoice: Invoice) => {
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', type: 'invoice', id: invoice.id }),
      })
      if (res.ok) {
        setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, status: 'PAID', amountDue: 0 } : i))
        setEditInvoice(null)
      }
    } catch {
      alert('Network error. Please try again.')
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
            <Table<I
