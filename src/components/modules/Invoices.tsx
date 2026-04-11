'use client'
import { useState, useEffect } from 'react'
import { Plus, Send, CheckCircle, AlertTriangle, Download, ExternalLink, Trash2 } from 'lucide-react'
import { PageHeader, Card, StatCard, Badge, Table, Tabs, Button, Modal, Input, EmptyState } from '@/components/ui'

type CustomField = { label: string; value: string }
type EditLineItem = { description: string; qty: string; rate: string }
type Invoice = { id: string; number: string; client: string; email?: string; amount: number; amountDue: number; status: string; issueDate: string; dueDate?: string; currency: string; notes?: string; customFields?: CustomField[] }
type Bill = { id: string; number: string; vendor: string; amount: number; amountPaid: number; status: string; billDate: string; dueDate?: string }
type ARStats = { totalAR: number; overdue: number; dueThisWeek: number; paidThisMonth: number }
type APStats = { totalAP: number; overdue: number; dueThisWeek: number; paidThisMonth: number }
type LineItem = { description: string; qty: string; rate: string }

const fmt = (c: number) => `$${(c / 100).toLocaleString()}`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const isOverdue = (d?: string) => d ? new Date(d) < new Date() : false

const defaultForm = {
  client: '', email: '', number: '',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: '', notes: '',
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
  const [editMode, setEditMode] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [editLineItems, setEditLineItems] = useState<EditLineItem[]>([{ description: '', qty: '1', rate: '' }])
  const [form, setForm] = useState(defaultForm)
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', qty: '1', rate: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [gettingPaymentLink, setGettingPaymentLink] = useState(false)

  const setField = (k: keyof typeof defaultForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const setLineField = (i: number, k: keyof LineItem) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLineItems(items => items.map((item, idx) => idx === i ? { ...item, [k]: e.target.value } : item))
  const setEditLineField = (i: number, k: keyof EditLineItem) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditLineItems(items => items.map((item, idx) => idx === i ? { ...item, [k]: e.target.value } : item))
  const addLineItem = () => setLineItems(items => [...items, { description: '', qty: '1', rate: '' }])
  const addEditLineItem = () => setEditLineItems(items => [...items, { description: '', qty: '1', rate: '' }])
  const lineTotal = (item: LineItem | EditLineItem) => (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)
  const invoiceTotal = lineItems.reduce((s, item) => s + lineTotal(item), 0)
  const editInvoiceTotal = editLineItems.reduce((s, item) => s + lineTotal(item), 0)
  const resetForm = () => { setForm(defaultForm); setLineItems([{ description: '', qty: '1', rate: '' }]); setNewInvoice(false) }

  const openEdit = (invoice: Invoice) => {
    setEditInvoice(invoice)
    setEditMode(false)
    setCustomFields(invoice.customFields || [])
    const existing = Array.isArray((invoice as any).lineItems) && (invoice as any).lineItems.length > 0
      ? (invoice as any).lineItems.map((i: any) => ({ description: i.description || '', qty: String(i.quantity || 1), rate: String((i.unitPrice || 0)) }))
      : [{ description: '', qty: '1', rate: '' }]
    setEditLineItems(existing)
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
      if (data.url) window.open(data.url, '_blank')
      else alert('Error: ' + (data.error || 'Could not create payment link'))
    } catch {
      alert('Network error creating payment link')
    } finally {
      setGettingPaymentLink(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editInvoice) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_invoice',
          id: editInvoice.id,
          customerName: editInvoice.client,
          customerEmail: editInvoice.email,
          dueDate: editInvoice.dueDate,
          issueDate: editInvoice.issueDate,
          notes: editInvoice.notes,
          customFields,
          lineItems: editLineItems.filter(i => i.description || i.rate).map(i => ({
            description: i.description,
            quantity: parseFloat(i.qty) || 1,
            unitPrice: parseFloat(i.rate) || 0,
          })),
        }),
      })
      if (res.ok) {
        const updated = { ...editInvoice, customFields }
        setInvoices(prev => prev.map(i => i.id === editInvoice.id ? updated : i))
        setEditInvoice(updated)
        setEditMode(false)
        fetch('/api/finance?view=invoices').then(r => r.json()).then(d => setInvoices(d.invoices || []))
      } else {
        alert('Failed to update invoice.')
      }
    } catch {
      alert('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (send: boolean) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_invoice',
          customerName: form.client,
          customerEmail: form.email,
          dueDate: form.dueDate,
          notes: form.notes,
          lineItems: lineItems.filter(i => i.description || i.rate).map(i => ({
            description: i.description,
            quantity: parseFloat(i.qty) || 1,
            unitPrice: parseFloat(i.rate) || 0,
          })),
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setInvoices(prev => [created.invoice, ...prev])
        resetForm()
      } else {
        alert('Failed to save invoice.')
      }
    } catch {
      alert('Network error.')
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
      alert('Network error.')
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
            <Table<Invoice>
              onRowClick={(row) => openEdit(row)}
              columns={[
                { key: 'number', header: 'Invoice #', render: r => <span className="font-mono text-sm font-medium text-gray-700">{r.number}</span> },
                { key: 'client', header: 'Client', render: r => <span className="font-medium text-gray-900">{r.client || '—'}</span> },
                { key: 'amount', header: 'Amount', render: r => <span className="font-semibold tabular-nums">{fmt(r.amount)}</span> },
                { key: 'amountDue', header: 'Balance Due', render: r => (
                  <span className={`font-bold tabular-nums ${r.amountDue > 0 ? 'text-red-600' : 'text-[#00a855]'}`}>{fmt(r.amountDue)}</span>
                )},
                { key: 'issueDate', header: 'Issued', render: r => <span className="text-sm text-gray-500">{fmtDate(r.issueDate)}</span> },
                { key: 'dueDate', header: 'Due', render: r => (
                  <span className={`text-sm ${isOverdue(r.dueDate) && r.status !== 'PAID' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {fmtDate(r.dueDate)}{isOverdue(r.dueDate) && r.status !== 'PAID' && ' ⚠'}
                  </span>
                )},
                { key: 'status', header: 'Status', render: r => (
                  <Badge variant={r.status === 'PAID' ? 'green' : r.status === 'OVERDUE' ? 'red' : r.status === 'SENT' ? 'blue' : r.status === 'PARTIAL' ? 'yellow' : 'gray'}>
                    {r.status.toLowerCase()}
                  </Badge>
                )},
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
                  <span className={`text-sm ${isOverdue(r.dueDate) && r.status !== 'paid' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{fmtDate(r.dueDate)}</span>
                )},
                { key: 'status', header: 'Status', render: r => (
                  <Badge variant={r.status === 'paid' ? 'green' : r.status === 'approved' ? 'blue' : 'gray'}>{r.status}</Badge>
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
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Current', days: '0 days', color: '#00a855', value: invoices.filter(i => !isOverdue(i.dueDate) && i.status !== 'PAID').reduce((s, i) => s + i.amountDue, 0) },
                { label: '1–30 days', days: 'overdue', color: '#d97706', value: overdueInvoices.filter(i => Math.floor((Date.now() - new Date(i.dueDate || '').getTime()) / 86400000) <= 30).reduce((s, i) => s + i.amountDue, 0) },
                { label: '31–60 days', days: 'overdue', color: '#ef4444', value: overdueInvoices.filter(i => { const age = Math.floor((Date.now() - new Date(i.dueDate || '').getTime()) / 86400000); return age > 30 && age <= 60 }).reduce((s, i) => s + i.amountDue, 0) },
                { label: '61–90 days', days: 'overdue', color: '#dc2626', value: overdueInvoices.filter(i => { const age = Math.floor((Date.now() - new Date(i.dueDate || '').getTime()) / 86400000); return age > 60 && age <= 90 }).reduce((s, i) => s + i.amountDue, 0) },
                { label: '90+ days', days: 'overdue', color: '#991b1b', value: overdueInvoices.filter(i => Math.floor((Date.now() - new Date(i.dueDate || '').getTime()) / 86400000) > 90).reduce((s, i) => s + i.amountDue, 0) },
              ].map(bucket => (
                <div key={bucket.label} className="text-center p-4 rounded-xl bg-gray-50 border border-black/[0.07]">
                  <div className="text-xs text-gray-400 mb-1">{bucket.label}</div>
                  <div className="text-xs text-gray-400 mb-2">{bucket.days}</div>
                  <div className="font-black text-lg" style={{ color: bucket.value > 0 ? bucket.color : '#9ca3af', fontFamily: 'Cabinet Grotesk, sans-serif' }}>{fmt(bucket.value)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Invoice Detail / Edit Modal */}
      <Modal open={!!editInvoice} onClose={() => { setEditInvoice(null); setEditMode(false) }} title={editMode ? `Editing ${editInvoice?.number || ''}` : `Invoice ${editInvoice?.number || ''}`} width="max-w-2xl">
        {editInvoice && (
          <div className="p-6 space-y-5">

            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Invoice Number</div>
                <div className="font-mono font-semibold text-gray-900 pt-1">{editInvoice.number}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Status</div>
                <div className="pt-1">
                  <Badge variant={editInvoice.status === 'PAID' ? 'green' : editInvoice.status === 'OVERDUE' ? 'red' : editInvoice.status === 'SENT' ? 'blue' : 'gray'}>
                    {editInvoice.status.toLowerCase()}
                  </Badge>
                </div>
              </div>
              <div className="col-span-2">
                <Input label="Client Name" value={editInvoice.client || ''} onChange={e => setEditInvoice(prev => prev ? { ...prev, client: e.target.value } : null)} placeholder="Client name" disabled={!editMode} />
              </div>
              <div className="col-span-2">
                <Input label="Client Email" type="email" value={editInvoice.email || ''} onChange={e => setEditInvoice(prev => prev ? { ...prev, email: e.target.value } : null)} placeholder="client@email.com" disabled={!editMode} />
              </div>
              <div>
                <Input label="Issue Date" type="date" value={editInvoice.issueDate ? editInvoice.issueDate.split('T')[0] : ''} onChange={e => setEditInvoice(prev => prev ? { ...prev, issueDate: e.target.value } : null)} disabled={!editMode} />
              </div>
              <div>
                <Input label="Due Date" type="date" value={editInvoice.dueDate ? editInvoice.dueDate.split('T')[0] : ''} onChange={e => setEditInvoice(prev => prev ? { ...prev, dueDate: e.target.value } : null)} disabled={!editMode} />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Total Amount</div>
                <div className="font-semibold text-gray-900 pt-1">{fmt(editInvoice.amount)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Balance Due</div>
                <div className={`font-bold pt-1 ${editInvoice.amountDue > 0 ? 'text-red-600' : 'text-[#00a855]'}`}>{fmt(editInvoice.amountDue)}</div>
              </div>
              <div className="col-span-2">
                <Input label="Notes / Payment Terms" value={editInvoice.notes || ''} onChange={e => setEditInvoice(prev => prev ? { ...prev, notes: e.target.value } : null)} placeholder="Payment due within 30 days" disabled={!editMode} />
              </div>
            </div>

            {/* Line Items */}
            {editMode && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Line Items</div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-1">
                    <span className="col-span-5">Description</span>
                    <span className="col-span-2">Item #</span>
                    <span className="col-span-2">Qty</span>
                    <span className="col-span-2">Price</span>
                    <span className="col-span-1"></span>
                  </div>
                  {editLineItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5"><Input placeholder="Description" value={item.description} onChange={e => { e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1); setEditLineField(i, 'description')(e) }} /></div>
                      <div className="col-span-2"><Input placeholder="SKU" value={(item as any).sku || ''} onChange={e => setEditLineItems(prev => prev.map((it, idx) => idx === i ? { ...it, sku: e.target.value } : it))} /></div>
                      <div className="col-span-2"><Input type="number" placeholder="1" value={item.qty} onChange={setEditLineField(i, 'qty')} /></div>
                      <div className="col-span-2"><Input type="number" placeholder="0.00" value={item.rate} onChange={setEditLineField(i, 'rate')} /></div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => setEditLineItems(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <Button size="xs" variant="ghost" onClick={addEditLineItem}>+ Add line item</Button>
                  <div className="text-sm font-bold text-gray-800">Total: ${editInvoiceTotal.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* Custom Fields */}
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">Custom Fields</div>
              {customFields.length === 0 && !editMode && (
                <div className="text-xs text-gray-400">No custom fields. Click Edit Invoice to add.</div>
              )}
              {editMode ? (
                <div className="space-y-2">
                  {customFields.map((field, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="Field label (e.g. PO Number)" value={field.label} onChange={e => setCustomFields(prev => prev.map((f, idx) => idx === i ? { ...f, label: e.target.value } : f))} />
                      <Input placeholder="Value" value={field.value} onChange={e => setCustomFields(prev => prev.map((f, idx) => idx === i ? { ...f, value: e.target.value } : f))} />
                      <button onClick={() => setCustomFields(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <Button size="xs" variant="ghost" onClick={() => setCustomFields(prev => [...prev, { label: '', value: '' }])}>+ Add custom field</Button>
                </div>
              ) : (
                customFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {customFields.map((field, i) => (
                      <div key={i}>
                        <div className="text-xs font-medium text-gray-500 mb-1">{field.label}</div>
                        <div className="text-sm text-gray-900">{field.value}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 flex-wrap">
              {!editMode ? (
                <>
                  <Button variant="secondary" className="flex-1" onClick={() => setEditMode(true)}>Edit Invoice</Button>
                  <Button variant="secondary" className="flex-1" icon={Download} onClick={() => handleViewPDF(editInvoice)}>View PDF</Button>
                  {editInvoice.status !== 'PAID' && editInvoice.status !== 'VOID' && (
                    <Button variant="primary" className="flex-1" icon={ExternalLink} onClick={() => handleGetPaymentLink(editInvoice)} disabled={gettingPaymentLink}>
                      {gettingPaymentLink ? 'Getting link...' : 'Payment Link'}
                    </Button>
                  )}
                  {editInvoice.status !== 'PAID' && editInvoice.status !== 'VOID' && (
                    <Button variant="success" className="flex-1" icon={CheckCircle} onClick={() => handleMarkPaid(editInvoice)}>Mark Paid</Button>
                  )}
                  <Button variant="secondary" onClick={() => setEditInvoice(null)}>Close</Button>
                </>
              ) : (
                <>
                  <Button variant="success" className="flex-1" onClick={handleSaveEdit} disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setEditMode(false)}>Cancel</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* New Invoice Modal */}
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
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6"><Input placeholder="Service description" value={item.description} onChange={setLineField(i, 'description')} /></div>
                  <div className="col-span-2"><Input type="number" value={item.qty} onChange={setLineField(i, 'qty')} /></div>
                  <div className="col-span-2"><Input type="number" placeholder="0.00" value={item.rate} onChange={setLineField(i, 'rate')} /></div>
                  <div className="col-span-2 flex items-center justify-center text-sm font-semibold text-gray-700">${lineTotal(item).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <Button size="xs" variant="ghost" className="mt-2" onClick={addLineItem}>+ Add line item</Button>
          </div>
          <div className="flex justify-end text-sm font-bold text-gray-800 pr-1">Total: ${invoiceTotal.toFixed(2)}</div>
          <Input label="Notes / payment terms" placeholder="Payment due within 30 days" value={form.notes} onChange={setField('notes')} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => handleSubmit(false)} disabled={submitting}>{submitting ? 'Saving…' : 'Save as Draft'}</Button>
            <Button variant="success" className="flex-1" icon={Send} onClick={() => handleSubmit(true)} disabled={submitting}>{submitting ? 'Sending…' : 'Save & Send'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
