import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      name: business.name,
      legalName: business.legalName,
      address: business.address,
      taxId: business.taxId,
      baseCurrency: business.baseCurrency || 'USD',
      branding: (business.address as any)?.branding || {
        logoUrl: null,
        primaryColor: '#00a855',
        accentColor: '#0a0a0a',
        invoiceFooter: 'Thank you for your business!',
        paymentTerms: 'Net 30',
        invoiceNote: 'Payment due within 30 days of invoice date.',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, userId } = await auth()
    const id = orgId || userId
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const business = await db.business.findFirst({ where: { clerkOrgId: id } })
    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const { name, legalName, taxId, baseCurrency, branding, address } = body

    const currentAddress = (business.address as any) || {}

    await db.business.update({
      where: { id: business.id },
      data: {
        name: name || business.name,
        legalName: legalName || business.legalName,
        taxId: taxId || business.taxId,
        baseCurrency: baseCurrency || business.baseCurrency,
        address: {
          ...currentAddress,
          ...address,
          branding: {
            ...(currentAddress.branding || {}),
            ...branding,
          },
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
