import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const error = searchParams.get('error')

  if (error || !code || !shop) {
    return NextResponse.redirect('http://localhost:3000/dashboard/integrations?error=shopify_failed')
  }

  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    })

    const tokens = await res.json()
    const { db } = await import('@/lib/db')
    const business = await db.business.findFirst()

    if (business) {
      await db.integration.upsert({
        where: { businessId_type: { businessId: business.id, type: 'shopify' } },
        create: {
          businessId: business.id,
          type: 'shopify',
          status: 'active',
          credentials: { accessToken: tokens.access_token, shop },
          metadata: { shop, scope: tokens.scope },
        },
        update: {
          status: 'active',
          credentials: { accessToken: tokens.access_token, shop },
          metadata: { shop, scope: tokens.scope },
        },
      })
      console.log('Shopify integration saved successfully!')
    }
  } catch (err) {
    console.error('Shopify callback error:', err)
  }

  return NextResponse.redirect('http://localhost:3000/dashboard/integrations?connected=shopify')
}
