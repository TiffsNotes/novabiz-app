import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { triggerOnboarding } from '@/lib/jobs/queue'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action } = body

  if (action === 'save_profile') {
    const { name, industry, employeeCount, annualRevenue } = body

    // Upsert business
    const business = await db.business.upsert({
      where: { clerkOrgId: orgId },
      create: {
        clerkOrgId: orgId,
        name: name || 'My Business',
        industry,
        onboardingStep: 1,
        users: {
          create: {
            clerkUserId: userId,
            email: '',
            role: 'OWNER',
          },
        },
      },
      update: {
        name: name || undefined,
        industry: industry || undefined,
        onboardingStep: 1,
      },
    })

    // Create default chart of accounts
    await createDefaultCOA(business.id)

    return NextResponse.json({ success: true, businessId: business.id })
  }

  if (action === 'complete') {
    const business = await db.business.findUnique({ where: { clerkOrgId: orgId } })
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    await db.business.update({
      where: { id: business.id },
      data: { onboardingComplete: true, onboardingStep: 4 },
    })

    // Trigger background AI onboarding sequence
    try {
      await triggerOnboarding(business.id)
    } catch {
      // Queue might not be available in dev
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

async function createDefaultCOA(businessId: string) {
  const accounts = [
    { code: '1000', name: 'Cash & Bank', type: 'ASSET' as const, subtype: 'current_asset' },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET' as const, subtype: 'current_asset' },
    { code: '1200', name: 'Inventory', type: 'ASSET' as const, subtype: 'current_asset' },
    { code: '1500', name: 'Equipment', type: 'ASSET' as const, subtype: 'fixed_asset' },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' as const, subtype: 'current_liability' },
    { code: '2100', name: 'Credit Cards', type: 'LIABILITY' as const, subtype: 'current_liability' },
    { code: '2200', name: 'Payroll Liabilities', type: 'LIABILITY' as const, subtype: 'current_liability' },
    { code: '3000', name: 'Owner Equity', type: 'EQUITY' as const },
    { code: '4000', name: 'Sales Revenue', type: 'REVENUE' as const },
    { code: '4100', name: 'Service Revenue', type: 'REVENUE' as const },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' as const },
    { code: '6000', name: 'Payroll & Benefits', type: 'EXPENSE' as const },
    { code: '6100', name: 'Rent & Utilities', type: 'EXPENSE' as const },
    { code: '6200', name: 'Marketing & Advertising', type: 'EXPENSE' as const },
    { code: '6300', name: 'Software & Subscriptions', type: 'EXPENSE' as const },
    { code: '6400', name: 'Professional Services', type: 'EXPENSE' as const },
    { code: '6500', name: 'Office & Supplies', type: 'EXPENSE' as const },
    { code: '6600', name: 'Travel & Meals', type: 'EXPENSE' as const },
    { code: '6700', name: 'Bank Fees', type: 'EXPENSE' as const },
    { code: '6800', name: 'Taxes & Licenses', type: 'EXPENSE' as const },
  ]

  for (const acct of accounts) {
    await db.ledgerAccount.upsert({
      where: { businessId_code: { businessId, code: acct.code } },
      create: { businessId, isSystem: true, ...acct },
      update: {},
    })
  }

  // Also create default categories
  const categories = [
    { name: 'Sales Revenue', type: 'INCOME' as const, coaCode: '4000' },
    { name: 'Service Revenue', type: 'INCOME' as const, coaCode: '4100' },
    { name: 'Cost of Goods Sold', type: 'EXPENSE' as const, coaCode: '5000' },
    { name: 'Payroll & Benefits', type: 'EXPENSE' as const, coaCode: '6000' },
    { name: 'Rent & Utilities', type: 'EXPENSE' as const, coaCode: '6100' },
    { name: 'Marketing & Advertising', type: 'EXPENSE' as const, coaCode: '6200' },
    { name: 'Software & Subscriptions', type: 'EXPENSE' as const, coaCode: '6300' },
    { name: 'Professional Services', type: 'EXPENSE' as const, coaCode: '6400' },
    { name: 'Office & Supplies', type: 'EXPENSE' as const, coaCode: '6500' },
    { name: 'Travel & Meals', type: 'EXPENSE' as const, coaCode: '6600' },
    { name: 'Bank Fees', type: 'EXPENSE' as const, coaCode: '6700' },
    { name: 'Taxes & Licenses', type: 'EXPENSE' as const, coaCode: '6800' },
  ]

  for (const cat of categories) {
    await db.category.upsert({
      where: { businessId_name: { businessId, name: cat.name } },
      create: { businessId, isSystem: true, ...cat },
      update: {},
    })
  }
}
