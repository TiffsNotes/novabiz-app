export function getGmailAuthUrl(state: string): string {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'openid',
    'email',
    'profile',
  ].join(' ')
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope as string,
  }
}

export class GmailSync {
  private accessToken: string
  private businessId: string
  constructor(accessToken: string, businessId: string) {
    this.accessToken = accessToken
    this.businessId = businessId
  }
  async runFullSync() { return { synced: {}, errors: [] } }
  async runIncrementalSync(since: Date) { return { synced: {}, errors: [] } }
}
