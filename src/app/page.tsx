import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

export default async function HomePage() {
  const { orgId } = await auth()

  if (!orgId) {
    redirect('/auth/login')
  }

  const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })

  if (!business || !business.onboardingComplete) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}
