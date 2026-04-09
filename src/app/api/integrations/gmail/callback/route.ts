import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect('http://localhost:3000/dashboard/integrations?error=gmail_failed')
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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

    const tokens = await tokenRes.json()

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()
    const connectedEmail = profile.email ?? 'gmail'

    const { db } = await import('@/lib/db')
    const business = await db.business.findFirst()

    if (business) {
      await db.integration.upsert({
        where: { businessId_type: { businessId: business.id, type: 'gmail' } },
        create: {
          businessId: business.id,
          type: 'gmail',
          status: 'active',
          credentials: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            email: connectedEmail,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          },
          metadata: { email: connectedEmail },
        },
        update: {
          status: 'active',
          credentials: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            email: connectedEmail,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          },
        },
      })
      console.log('Gmail integration saved successfully! Email:', connectedEmail)
    }
  } catch (err) {
    console.error('Gmail callback error:', err)
  }

  return NextResponse.redirect('http://localhost:3000/dashboard/integrations?connected=gmail')
}
