import { verifyShopifyWebhook, processShopifyWebhook } from '@/lib/integrations/shopify'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: { topic: string } }) {
  const signature = req.headers.get('x-shopify-hmac-sha256') ?? ''
  const shopDomain = req.headers.get('x-shopify-shop-domain') ?? ''
  const body = await req.text()
  if (!verifyShopifyWebhook(body, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  const integration = await db.integration.findFirst({ where: { externalId: shopDomain, provider: 'shopify' } })
  if (!integration) return NextResponse.json({ ok: true })
  const topic = params.topic.replace('_', '/')
  let payload: any
  try { payload = JSON.parse(body) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  await processShopifyWebhook(topic, payload, integration.businessId)
  return NextResponse.json({ ok: true })
}
