import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const invoice = await db.invoice.findUnique({
      where: { id: params.id },
      include: { lineItems: true },
    })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const address = (business.address as any) || {}
    const branding = address.branding || {}
    const primaryColor = branding.primaryColor || '#00a855'

    const fmt = (cents: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency || 'USD' }).format(cents / 100)

    const lineItemsHtml = (invoice.lineItems || []).map((item: any) =>
      '<tr>' +
      '<td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">' + (item.description || item.title || '') + '</td>' +
      '<td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:center;">' + (item.quantity || 1) + '</td>' +
      '<td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;">' + fmt(item.unitPrice || 0) + '</td>' +
      '<td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;">' + fmt((item.quantity || 1) * (item.unitPrice || 0)) + '</td>' +
      '</tr>'
    ).join('')

    const billTo = (invoice as any).contactName || (invoice.notes || '').split('\n')[0] || 'Customer'
    const issueDate = new Date(invoice.issueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'On Receipt'
    const totalDue = fmt(invoice.amountDue || invoice.total || 0)
    const subtotal = fmt(invoice.subtotal || 0)
    const taxAmount = invoice.taxAmount ? fmt(invoice.taxAmount) : null
    const paymentUrl = invoice.pdfUrl || ''
    const invoiceNotes = invoice.notes || ''
    const footer = branding.invoiceFooter || 'Thank you for your business!'

    const html = '<!DOCTYPE html>' +
      '<html><head><meta charset="utf-8"><style>' +
      '* { margin: 0; padding: 0; box-sizing: border-box; }' +
      'body { font-family: -apple-system, sans-serif; color: #111; background: white; padding: 60px; }' +
      '.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; }' +
      '.business-name { font-size: 28px; font-weight: 800; color: ' + primaryColor + '; letter-spacing: -0.5px; }' +
      '.business-info { font-size: 13px; color: #666; margin-top: 8px; line-height: 1.6; }' +
      '.invoice-title { text-align: right; }' +
      '.invoice-title h1 { font-size: 36px; font-weight: 800; color: #111; letter-spacing: -1px; }' +
      '.invoice-number { font-size: 14px; color: #666; margin-top: 4px; }' +
      '.divider { border: none; border-top: 2px solid ' + primaryColor + '; margin: 40px 0; }' +
      '.dates { display: flex; gap: 60px; margin-bottom: 40px; }' +
      '.date-item h3 { font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }' +
      '.date-item p { font-size: 14px; font-weight: 500; }' +
      'table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }' +
      'th { font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px; padding: 0 0 12px 0; border-bottom: 2px solid #111; text-align: left; }' +
      '.totals { margin-left: auto; width: 280px; }' +
      '.total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }' +
      '.total-row.grand { font-size: 18px; font-weight: 800; border-bottom: none; margin-top: 8px; color: ' + primaryColor + '; }' +
      '.footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #999; text-align: center; }' +
      '</style></head><body>' +
      '<div class="header">' +
      '<div>' +
      '<div class="business-name">' + business.name + '</div>' +
      '<div class="business-info">' +
      (address.street ? address.street + '<br>' : '') +
      (address.city ? address.city + ', ' + (address.state || '') + ' ' + (address.zip || '') + '<br>' : '') +
      (business.taxId ? 'Tax ID: ' + business.taxId : '') +
      '</div></div>' +
      '<div class="invoice-title"><h1>INVOICE</h1>' +
      '<div class="invoice-number">' + invoice.number + '</div>' +
      '</div></div>' +
      '<hr class="divider">' +
      '<div class="dates">' +
      '<div class="date-item"><h3>Bill To</h3><p>' + billTo + '</p></div>' +
      '<div class="date-item"><h3>Issue Date</h3><p>' + issueDate + '</p></div>' +
      '<div class="date-item"><h3>Due Date</h3><p>' + dueDate + '</p></div>' +
      '</div>' +
      '<table><thead><tr>' +
      '<th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th>' +
      '</tr></thead><tbody>' +
      (lineItemsHtml || '<tr><td colspan="4" style="padding:20px 0;color:#999;">No line items</td></tr>') +
      '</tbody></table>' +
      '<div class="totals">' +
      '<div class="total-row"><span>Subtotal</span><span>' + subtotal + '</span></div>' +
      (taxAmount ? '<div class="total-row"><span>Tax</span><span>' + taxAmount + '</span></div>' : '') +
      '<div class="total-row grand"><span>Total Due</span><span>' + totalDue + '</span></div>' +
      '</div>' +
      (paymentUrl ? '<div style="margin-top:40px;padding:20px;background:' + primaryColor + '10;border-radius:12px;border:1px solid ' + primaryColor + '30;"><p style="font-size:14px;font-weight:700;color:' + primaryColor + ';margin-bottom:8px;">Pay Online</p><a href="' + paymentUrl + '" style="color:' + primaryColor + ';font-size:13px;">' + paymentUrl + '</a></div>' : '') +
      (invoiceNotes ? '<p style="margin-top:30px;font-size:13px;color:#666;">' + invoiceNotes + '</p>' : '') +
      '<div class="footer">' + footer + '<br>' + business.name + ' - Generated by NovaBiz OS</div>' +
      '</body></html>'

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': 'inline; filename="invoice-' + invoice.number + '.html"',
      },
    })
  } catch (err: any) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
