import { getShopifyAuthUrl } from '@/lib/integrations/shopify'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const shop = new URL(req.url).searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'Missing shop param' }, { status: 400 })
  const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(cleanShop)) {
    return NextResponse.json({ error: 'Invalid Shopify domain' }, { status: 400 })
  }
  const state = Buffer.from(JSON.stringify({ shop: cleanShop, ts: Date.now() })).toString('base64')
  return NextResponse.redirect(getShopifyAuthUrl(cleanShop, state))
}
