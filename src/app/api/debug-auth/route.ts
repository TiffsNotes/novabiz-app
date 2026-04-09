import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { userId, orgId } = await auth()
  return NextResponse.json({ userId, orgId })
}
