import { getGmailAuthUrl } from '@/lib/integrations/gmail'
import { NextResponse } from 'next/server'

export async function GET() {
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64')
  return NextResponse.redirect(getGmailAuthUrl(state))
}
