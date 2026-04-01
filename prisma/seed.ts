import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding NovaBiz OS demo data...')

  // Create demo business
  const business = await db.business.upsert({
    where: { clerkOrgId: 'demo_org_001' },
    create: {
      clerkOrgId: 'demo_org_001',
      name: 'Pacific Coast Grill',
      legalName: 'Pacific Coast Grill LLC',
      industry: 'restaurant',
      plan: 'PRO',
      annualRevenue: 180000000, // $1.8M
      employeeCount: 18,
      timezone: 'America/Los_Angeles',
      onboardingComplete: true,
      onboardingStep: 4,
    },
    update: {},
  })

  console.log(`  ✓ Business: ${business.name}`)

  // ── CHART OF ACCOUNTS ─────────────────────────────────────
  const accounts = [
    { code: '1000', name: 'Cash & Bank', type: 'ASSET' as const },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET' as const },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' as const },
    { code: '4000', name: 'Food & Beverage Sales', type: 'REVENUE' as const },
    { code: '4100', name: 'Catering Revenue', type: 'REVENUE' as const },
    { code: '5000', name: 'Cost of Food & Bev', type: 'EXPENSE' as const },
    { code: '6000', name: 'Payroll & Benefits', type: 'EXPENSE' as const },
    { code: '6100', name: 'Rent & Utilities', type: 'EXPENSE' as const },
    { code: '6200', name: 'Marketing & Advertising', type: 'EXPENSE' as const },
    { code: '6300', name: 'Software & POS', type: 'EXPENSE' as const },
  ]
  for (const acct of accounts) {
    await db.ledgerAccount.upsert({
      where: { businessId_code: { businessId: business.id, code: acct.code } },
      create: { businessId: business.id, isSystem: true, isActive: true, balance: 0, ...acct },
      update: {},
    })
  }

  // ── CATEGORIES ────────────────────────────────────────────
  const categories = [
    { name: 'Food & Beverage Sales', type: 'INCOME' as const },
    { name: 'Catering Revenue', type: 'INCOME' as const },
    { name: 'Cost of Food & Beverage', type: 'EXPENSE' as const },
    { name: 'Payroll & Benefits', type: 'EXPENSE' as const },
    { name: 'Rent & Utilities', type: 'EXPENSE' as const },
    { name: 'Marketing & Advertising', type: 'EXPENSE' as const },
    { name: 'Software & Subscriptions', type: 'EXPENSE' as const },
    { name: 'Supplies & Equipment', type: 'EXPENSE' as const },
    { name: 'Food Delivery Fees', type: 'EXPENSE' as const },
    { name: 'Bank Fees', type: 'EXPENSE' as const },
  ]
  for (const cat of categories) {
    await db.category.upsert({
      where: { businessId_name: { businessId: business.id, name: cat.name } },
      create: { businessId: business.id, isSystem: true, ...cat },
      update: {},
    })
  }
  console.log('  ✓ Chart of Accounts + Categories')

  // ── BANK ACCOUNT ──────────────────────────────────────────
  await db.bankAccount.upsert({
    where: { plaidAccountId: 'demo_checking_001' },
    create: {
      businessId: business.id,
      plaidAccountId: 'demo_checking_001',
      plaidItemId: 'demo_item_001',
      plaidAccessToken: 'demo_token',
      name: 'Pacific Coast Checking',
      mask: '4821',
      type: 'depository',
      subtype: 'checking',
      currentBalance: 8470000,  // $84,700
      availableBalance: 8420000,
      institution: 'Chase',
      lastSync: new Date(),
    },
    update: { currentBalance: 8470000 },
  })
  console.log('  ✓ Bank account')

  // ── TRANSACTIONS (last 90 days) ───────────────────────────
  const incomeCategory = await db.category.findFirst({ where: { businessId: business.id, name: 'Food & Beverage Sales' } })
  const payrollCategory = await db.category.findFirst({ where: { businessId: business.id, name: 'Payroll & Benefits' } })
  const rentCategory = await db.category.findFirst({ where: { businessId: business.id, name: 'Rent & Utilities' } })

  const txData = []
  for (let day = 89; day >= 0; day--) {
    const date = new Date(Date.now() - day * 86400000)
    // Daily revenue (varies by day of week)
    const dow = date.getDay()
    const multiplier = dow === 0 || dow === 6 ? 1.4 : dow === 5 ? 1.2 : 1.0
    const dailyRevenue = Math.round(450000 * multiplier * (0.85 + Math.random() * 0.3)) // ~$4,500 avg
    txData.push({ date, amount: dailyRevenue, description: 'Daily Sales - Square POS', categoryId: incomeCategory?.id, reviewed: true, categorySource: 'rule', categoryConfidence: 0.99 })
  }

  // Monthly expenses
  for (let month = 2; month >= 0; month--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - month, 1)
    txData.push({ date: d, amount: -1500000, description: 'ADP Payroll Processing', categoryId: payrollCategory?.id, reviewed: true, categorySource: 'ai', categoryConfidence: 0.97 })
    txData.push({ date: new Date(d.getFullYear(), d.getMonth(), 5), amount: -450000, description: 'Pacific Properties - Rent', categoryId: rentCategory?.id, reviewed: true, categorySource: 'ai', categoryConfidence: 0.99 })
    txData.push({ date: new Date(d.getFullYear(), d.getMonth(), 3), amount: -8500, description: 'Toast POS Monthly', reviewed: true, categorySource: 'ai', categoryConfidence: 0.96 })
  }

  // Some uncategorized (for AutoBooks to process)
  for (let i = 0; i < 15; i++) {
    const date = new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000)
    txData.push({ date, amount: -(Math.round(Math.random() * 50000) + 5000), description: `${['Sysco Foods', 'Gordon Food Service', 'Restaurant Depot', 'Pacific Gas & Electric', 'Yelp Ads'][i % 5]} #${1000 + i}`, reviewed: false })
  }

  // Insert in batches
  const bankAccount = await db.bankAccount.findFirst({ where: { businessId: business.id } })
  for (const tx of txData) {
    await db.transaction.create({
      data: {
        businessId: business.id,
        bankAccountId: bankAccount?.id,
        plaidTxId: `demo_tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        pending: false,
        excluded: false,
        reconciled: true,
        ...tx,
      },
    })
  }
  console.log(`  ✓ ${txData.length} transactions`)

  // ── EMPLOYEES ─────────────────────────────────────────────
  const departments = [
    await db.department.create({ data: { businessId: business.id, name: 'Front of House', headcount: 8 } }),
    await db.department.create({ data: { businessId: business.id, name: 'Kitchen', headcount: 7 } }),
    await db.department.create({ data: { businessId: business.id, name: 'Management', headcount: 3 } }),
  ]

  const employeeData = [
    { firstName: 'Maria', lastName: 'Santos', email: 'maria@pcgrill.com', title: 'General Manager', type: 'FULL_TIME' as const, payRate: 8500000, payType: 'salary', departmentId: departments[2].id },
    { firstName: 'James', lastName: 'Chen', email: 'james@pcgrill.com', title: 'Head Chef', type: 'FULL_TIME' as const, payRate: 7200000, payType: 'salary', departmentId: departments[1].id },
    { firstName: 'Sofia', lastName: 'Martinez', email: 'sofia@pcgrill.com', title: 'Lead Server', type: 'FULL_TIME' as const, payRate: 1800, payType: 'hourly', departmentId: departments[0].id },
    { firstName: 'Tyler', lastName: 'Johnson', email: 'tyler@pcgrill.com', title: 'Line Cook', type: 'FULL_TIME' as const, payRate: 2200, payType: 'hourly', departmentId: departments[1].id },
    { firstName: 'Emma', lastName: 'Williams', email: 'emma@pcgrill.com', title: 'Bartender', type: 'PART_TIME' as const, payRate: 1600, payType: 'hourly', departmentId: departments[0].id },
  ]

  for (const emp of employeeData) {
    await db.employee.create({ data: { businessId: business.id, status: 'active', startDate: new Date('2022-01-15'), ...emp } })
  }
  console.log(`  ✓ ${employeeData.length} employees`)

  // ── CRM — CONTACTS & DEALS ────────────────────────────────
  const companies = await Promise.all([
    db.company.create({ data: { businessId: business.id, name: 'Coastal Events Co.', industry: 'Events', size: '11-50', revenue: 200000000 } }),
    db.company.create({ data: { businessId: business.id, name: 'SoCal Weddings', industry: 'Weddings', size: '1-10', revenue: 80000000 } }),
  ])

  const contacts = await Promise.all([
    db.contact.create({ data: { businessId: business.id, firstName: 'Jennifer', lastName: 'Park', email: 'jen@coastalevents.com', title: 'Event Director', companyId: companies[0].id, stage: 'qualified', score: 87, source: 'referral' } }),
    db.contact.create({ data: { businessId: business.id, firstName: 'Robert', lastName: 'Kim', email: 'rob@socalweddings.com', title: 'Owner', companyId: companies[1].id, stage: 'proposal', score: 72 } }),
  ])

  const pipeline = await db.pipeline.create({ data: { businessId: business.id, name: 'Catering Pipeline', isDefault: true, stages: JSON.stringify([{ id: 'prospect', name: 'Prospect', probability: 10 }, { id: 'qualified', name: 'Qualified', probability: 30 }, { id: 'proposal', name: 'Proposal', probability: 60 }, { id: 'negotiation', name: 'Negotiation', probability: 80 }]) } })

  await db.deal.create({ data: { businessId: business.id, pipelineId: pipeline.id, contactId: contacts[0].id, companyId: companies[0].id, name: 'Annual Conference Catering 2025', value: 3200000, stage: 'proposal', probability: 60, expectedClose: new Date(Date.now() + 30 * 86400000), aiInsights: 'High-value client with 3 previous events. Strong close probability given repeated engagement this week.' } })

  await db.deal.create({ data: { businessId: business.id, pipelineId: pipeline.id, contactId: contacts[1].id, companyId: companies[1].id, name: 'Summer Wedding Catering × 4', value: 1800000, stage: 'qualified', probability: 40, expectedClose: new Date(Date.now() + 60 * 86400000) } })
  console.log('  ✓ CRM contacts, companies & deals')

  // ── INVENTORY ─────────────────────────────────────────────
  const warehouse = await db.warehouse.create({ data: { businessId: business.id, name: 'Main Kitchen Store', code: 'KS-001', isDefault: true } })

  const products = await Promise.all([
    db.product.create({ data: { businessId: business.id, sku: 'PREM-RIBEYE', name: 'Premium Ribeye 12oz', type: 'physical', category: 'Protein', unitCost: 3200, sellingPrice: 6800, currency: 'USD' } }),
    db.product.create({ data: { businessId: business.id, sku: 'HOUSE-WINE-750', name: 'House Red Wine 750ml', type: 'physical', category: 'Beverage', unitCost: 1200, sellingPrice: 4800, currency: 'USD' } }),
    db.product.create({ data: { businessId: business.id, sku: 'LOBSTER-LB', name: 'Fresh Lobster per lb', type: 'physical', category: 'Seafood', unitCost: 2800, sellingPrice: 7200, currency: 'USD' } }),
    db.product.create({ data: { businessId: business.id, sku: 'CRAFT-BEER-KEG', name: 'Craft Beer Keg', type: 'physical', category: 'Beverage', unitCost: 15000, sellingPrice: 45000, currency: 'USD' } }),
  ])

  const invLevels = [
    { onHand: 45, reorderPoint: 20, reorderQty: 50 },
    { onHand: 8, reorderPoint: 12, reorderQty: 24 },   // LOW STOCK
    { onHand: 0, reorderPoint: 5, reorderQty: 15 },    // OUT OF STOCK
    { onHand: 6, reorderPoint: 4, reorderQty: 8 },
  ]

  for (let i = 0; i < products.length; i++) {
    await db.inventoryItem.create({
      data: {
        businessId: business.id,
        productId: products[i].id,
        warehouseId: warehouse.id,
        available: invLevels[i].onHand,
        reserved: 0,
        ...invLevels[i],
      },
    })
  }
  console.log('  ✓ Warehouse, products & inventory')

  // ── SAVINGS ENTRIES ───────────────────────────────────────
  const savingsData = [
    { module: 'AUTOBOOKS' as const, category: 'vendor_cancelled', amount: 80000, description: 'Bookkeeper monthly fee eliminated', recurring: true, vendorName: 'San Diego Bookkeeping Co' },
    { module: 'GROWTH' as const, category: 'vendor_cancelled', amount: 200000, description: 'Marketing agency retainer eliminated', recurring: true, vendorName: 'Coast Digital Agency' },
    { module: 'PAYROLL' as const, category: 'service_replaced', amount: 15000, description: 'ADP full-service payroll fee replaced', recurring: true, vendorName: 'ADP Full Service' },
    { module: 'COMPLIANCE' as const, category: 'error_caught', amount: 32000, description: 'Sales tax filing error caught by ComplianceGuard — avoided $320 penalty', recurring: false },
    { module: 'SUPPLY_CHAIN' as const, category: 'vendor_cancelled', amount: 20000, description: 'Inventory management software cancelled', recurring: true, vendorName: 'InventoryPro' },
    { module: 'SALES' as const, category: 'revenue_recovered', amount: 48000, description: '4 re-engaged catering clients via automated follow-up sequences', recurring: false },
  ]

  for (const s of savingsData) {
    await db.savingsEntry.create({ data: { businessId: business.id, date: new Date(Date.now() - Math.random() * 30 * 86400000), ...s } })
  }
  console.log(`  ✓ ${savingsData.length} savings entries ($${savingsData.reduce((s, e) => s + e.amount, 0) / 100}/mo documented)`)

  // ── INBOX ITEMS ───────────────────────────────────────────
  const action1 = await db.aiAction.create({
    data: {
      businessId: business.id, module: 'PAYROLL', actionType: 'run_payroll',
      title: 'Payroll run — Friday Nov 15',
      description: '5 employees · Pay period Oct 28 – Nov 10 · All calculations verified',
      payload: { runNumber: 'PR-1847', employeeCount: 5 },
      status: 'PENDING_APPROVAL', requiresApproval: true,
      approvalReason: 'All payroll runs require your approval',
      aiReasoning: 'Regular bi-weekly payroll cycle. All employee hours verified, deductions calculated, tax withholdings applied. Total gross: $18,420. Ready to process.',
      confidence: 0.99,
      amount: 1842000,
    },
  })
  await db.inboxItem.create({ data: { businessId: business.id, actionId: action1.id, title: 'Approve payroll — Friday Nov 15', description: '$18,420 · 5 employees · Deadline: Thursday 5pm', module: 'PAYROLL', urgency: 'HIGH', amount: 1842000, dueAt: new Date(Date.now() + 2 * 86400000) } })

  const action2 = await db.aiAction.create({
    data: {
      businessId: business.id, module: 'SUPPLY_CHAIN', actionType: 'create_purchase_order',
      title: 'PO: House Red Wine 750ml × 24',
      description: 'Stock at 8 units — below reorder point of 12. Auto-generated PO for 24 units from Pacific Wine Distributors.',
      payload: { sku: 'HOUSE-WINE-750', quantity: 24 },
      status: 'PENDING_APPROVAL', requiresApproval: true,
      aiReasoning: 'Stock level (8 units) has fallen below reorder point (12). Based on current weekly consumption of ~6 units, this represents ~9 days of supply. Recommending order of 24 units to restore 4-week buffer.',
      confidence: 0.94,
      amount: 28800,
    },
  })
  await db.inboxItem.create({ data: { businessId: business.id, actionId: action2.id, title: 'PO: House Red Wine × 24 units', description: '$288 · Pacific Wine Distributors · 8 units left', module: 'SUPPLY_CHAIN', urgency: 'NORMAL', amount: 28800 } })

  const action3 = await db.aiAction.create({
    data: {
      businessId: business.id, module: 'GROWTH', actionType: 'send_email_campaign',
      title: 'Email: Re-engage holiday catering prospects',
      description: 'AI-drafted email to 23 contacts who inquired about catering in Q4 last year',
      payload: { subject: "Still planning your holiday events?", recipientCount: 23 },
      status: 'PENDING_APPROVAL', requiresApproval: true,
      aiReasoning: 'Identified 23 contacts who inquired about holiday catering last year but did not book. Historical data shows 34% conversion rate for this type of re-engagement. Estimated revenue potential: $8,400.',
      confidence: 0.81,
    },
  })
  await db.inboxItem.create({ data: { businessId: business.id, actionId: action3.id, title: 'Send holiday catering email to 23 prospects', description: '"Still planning your holiday events?" · Est. $8,400 revenue opportunity', module: 'GROWTH', urgency: 'NORMAL' } })

  console.log('  ✓ 3 CommandInbox items')

  console.log('\n✅ Seed complete!')
  console.log(`   Business: ${business.name} (${business.id})`)
  console.log(`   Transactions: ${txData.length}`)
  console.log(`   Employees: ${employeeData.length}`)
  console.log(`   Inbox items: 3 pending approval`)
  console.log(`   Total monthly savings documented: $${savingsData.reduce((s, e) => s + e.amount, 0) / 100}/mo`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
