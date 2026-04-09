import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect('http://localhost:3000/dashboard/integrations?error=quickbooks_denied')
  }

  if (!code || !realmId) {
    return NextResponse.redirect('http://localhost:3000/dashboard/integrations?error=quickbooks_invalid')
  }

  // Exchange code for tokens
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.QB_REDIRECT_URI!,
    }),
  })

  if (!tokenRes.ok) {
    console.error('QB token exchange failed:', await tokenRes.text())
    return NextResponse.redirect('http://localhost:3000/dashboard/integrations?error=quickbooks_token')
  }

  const tokens = await tokenRes.json()
  console.log('QuickBooks connected! RealmId:', realmId)
  console.log('Access token received:', !!tokens.access_token)

  return NextResponse.redirect('http://localhost:3000/dashboard/integrations?connected=quickbooks')
}
