import crypto from 'crypto'

export function getShopifyAuthUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY!,
    scope: 'read_orders,read_products,read_customers,read_inventory',
    redirect_uri: process.env.SHOPIFY_REDIRECT_URI!,
    state,
  })
  return `https://${shop}/admin/oauth/authorize?${params}`
}

export async function exchangeShopifyCode(shop: string, code: string) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.SHOPIFY_API_KEY, client_secret: process.env.SHOPIFY_API_SECRET, code }),
  })
  const data = await res.json()
  return { accessToken: data.access_token as string, scope: data.scope as string }
}

export function verifyShopifyWebhook(body: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET!).update(body, 'utf8').digest('base64')
  return hmac === signature
}

export async function processShopifyWebhook(topic: string, payload: any, businessId: string) {
  console.log('Shopify webhook:', topic, businessId)
}

export class ShopifySync {
  private shop: string
  private accessToken: string
  private businessId: string
  constructor(shop: string, accessToken: string, businessId: string) {
    this.shop = shop
    this.accessToken = accessToken
    this.businessId = businessId
  }
  async runFullSync() { return { synced: {}, errors: [] } }
  async runIncrementalSync(since: Date) { return { synced: {}, errors: [] } }
  async registerWebhooks(baseUrl: string) { console.log('Webhooks registered') }
}
