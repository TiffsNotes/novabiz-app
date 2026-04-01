import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { AutoBooksAgent } from '@/lib/ai/autobooks'
import { PayrollAIAgent } from '@/lib/integrations/gusto'
import { CRMAgent } from '@/lib/ai/crm'
import { ERPAgent } from '@/lib/ai/erp'
import { syncTransactions } from '@/lib/integrations/plaid'
import { generateForecast } from '@/lib/ai/forecast'
import { buildReport } from '@/lib/ai/bi'
import { runNOVAIntelligence, runQuickScan } from '@/lib/ai/intelligence'
import { db } from '@/lib/db'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

// ─── QUEUES ──────────────────────────────────────────────────

export const aiQueue = new Queue('novabiz-ai', { connection })

// Schedule recurring jobs for all businesses
export async function scheduleRecurringJobs() {
  const businesses = await db.business.findMany({
    where: { plan: { not: 'TRIAL' }, onboardingComplete: true },
    select: { id: true },
  })

  for (const { id } of businesses) {
    // Sync bank transactions every hour
    await aiQueue.add('sync-transactions', { businessId: id }, {
      repeat: { every: 60 * 60 * 1000 }, // 1 hour
      jobId: `sync-${id}`,
    })

    // Run AutoBooks every 2 hours
    await aiQueue.add('run-autobooks', { businessId: id }, {
      repeat: { every: 2 * 60 * 60 * 1000 },
      jobId: `autobooks-${id}`,
    })

    // Update cash forecast daily at 6am
    await aiQueue.add('update-forecast', { businessId: id }, {
      repeat: { pattern: '0 6 * * *' },
      jobId: `forecast-${id}`,
    })

    // Check inventory reorder points every 4 hours
    await aiQueue.add('check-reorders', { businessId: id }, {
      repeat: { every: 4 * 60 * 60 * 1000 },
      jobId: `reorders-${id}`,
    })

    // Score CRM leads daily at 7am
    await aiQueue.add('score-leads', { businessId: id }, {
      repeat: { pattern: '0 7 * * *' },
      jobId: `score-leads-${id}`,
    })

    // Preview payroll weekly on Monday
    await aiQueue.add('preview-payroll', { businessId: id }, {
      repeat: { pattern: '0 8 * * 1' },
      jobId: `payroll-${id}`,
    })

    // Generate follow-ups daily at 9am
    await aiQueue.add('generate-followups', { businessId: id }, {
      repeat: { pattern: '0 9 * * *' },
      jobId: `followups-${id}`,
    })

    // NOVA Intelligence full scan every 6 hours
    await aiQueue.add('nova-intelligence', { businessId: id }, {
      repeat: { every: 6 * 60 * 60 * 1000 },
      jobId: `intelligence-${id}`,
    })

    // NOVA quick scan every 30 minutes (critical signals only)
    await aiQueue.add('nova-quick-scan', { businessId: id }, {
      repeat: { every: 30 * 60 * 1000 },
      jobId: `quick-scan-${id}`,
    })
  }
}

// ─── WORKER ──────────────────────────────────────────────────

export const worker = new Worker(
  'novabiz-ai',
  async (job: Job) => {
    const { businessId } = job.data
    console.log(`[Queue] Processing ${job.name} for ${businessId}`)

    switch (job.name) {
      case 'sync-transactions':
        return await syncTransactions(businessId)

      case 'run-autobooks': {
        const agent = new AutoBooksAgent(businessId)
        return await agent.run()
      }

      case 'update-forecast':
        return await generateForecast(businessId)

      case 'check-reorders': {
        const agent = new ERPAgent(businessId)
        return await agent.checkReorderPoints()
      }

      case 'score-leads': {
        const agent = new CRMAgent(businessId)
        return await agent.scoreLeads()
      }

      case 'preview-payroll': {
        const agent = new PayrollAIAgent(businessId)
        return await agent.previewPayroll()
      }

      case 'generate-followups': {
        const agent = new CRMAgent(businessId)
        return await agent.generateFollowUps()
      }

      case 'monthly-report': {
        const now = new Date()
        const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth()
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
        return await buildReport(businessId, {
          type: 'pl',
          period: `${year}-${String(lastMonth).padStart(2, '0')}`,
        })
      }

      case 'nova-intelligence':
        return await runNOVAIntelligence(businessId)

      case 'nova-quick-scan': {
        const signals = await runQuickScan(businessId)
        // Create critical inbox items for any new CRITICAL signals
        for (const signal of signals.filter(s => s.severity === 'CRITICAL')) {
          const existing = await db.inboxItem.findFirst({
            where: { businessId, title: { contains: signal.title.substring(0, 30) }, resolvedAt: null },
          })
          if (!existing) {
            const action = await db.aiAction.create({
              data: {
                businessId,
                module: 'COMMAND_INBOX',
                actionType: 'nova_alert',
                title: signal.title,
                description: signal.situation,
                payload: { signalId: signal.id, solution: signal.solution },
                status: 'PENDING_APPROVAL',
                requiresApproval: false,
                aiReasoning: signal.impact,
                confidence: 1.0,
              },
            })
            await db.inboxItem.create({
              data: {
                businessId,
                actionId: action.id,
                title: `⚠ NOVA Alert: ${signal.title}`,
                description: signal.situation,
                module: 'COMMAND_INBOX',
                urgency: 'CRITICAL',
              },
            })
          }
        }
        return { signals: signals.length }
      }

      case 'sync-employees': {
        const agent = new PayrollAIAgent(businessId)
        return await agent.syncEmployees()
      }

      default:
        console.warn(`[Queue] Unknown job: ${job.name}`)
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 60000 }, // 10 jobs/minute per queue
  }
)

worker.on('completed', (job) => {
  console.log(`[Queue] ✓ ${job.name} completed (${job.id})`)
})

worker.on('failed', (job, err) => {
  console.error(`[Queue] ✗ ${job?.name} failed:`, err.message)
})

// ─── TRIGGER ON-DEMAND ───────────────────────────────────────

export async function triggerSync(businessId: string) {
  await aiQueue.add('sync-transactions', { businessId }, { priority: 1 })
  await aiQueue.add('run-autobooks', { businessId }, { priority: 2, delay: 30000 }) // 30s after sync
}

export async function triggerOnboarding(businessId: string) {
  // Full onboarding sequence
  await aiQueue.addBulk([
    { name: 'sync-transactions', data: { businessId }, opts: { priority: 1 } },
    { name: 'sync-employees', data: { businessId }, opts: { priority: 2, delay: 10000 } },
    { name: 'run-autobooks', data: { businessId }, opts: { priority: 3, delay: 60000 } },
    { name: 'update-forecast', data: { businessId }, opts: { priority: 4, delay: 90000 } },
    { name: 'score-leads', data: { businessId }, opts: { priority: 5, delay: 120000 } },
  ])
}
