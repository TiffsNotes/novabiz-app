import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { userId, orgId } = await auth()
  const id = orgId || userId
  if (!id) {
    return NextResponse.redirect('http://localhost:3000/auth/login')
  }
  const state = Buffer.from(JSON.stringify({ orgId: id, ts: Date.now() })).toString('base64')
  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID!,
    redirect_uri: process.env.QB_REDIRECT_URI!,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state,
  })
  return NextResponse.redirect(`https://appcenter.intuit.com/connect/oauth2?${params}`)
}
