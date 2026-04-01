// NovaBiz OS — Background Worker
// Run with: npx tsx src/lib/jobs/worker.ts
// Or in production: node dist/lib/jobs/worker.js

import { worker, scheduleRecurringJobs } from './queue'

console.log('🤖 NovaBiz AI Worker starting...')

worker.on('ready', () => {
  console.log('✅ Worker connected to Redis')
})

worker.on('completed', (job) => {
  console.log(`[${new Date().toISOString()}] ✓ ${job.name} (${job.id}) — ${job.data.businessId}`)
})

worker.on('failed', (job, err) => {
  console.error(`[${new Date().toISOString()}] ✗ ${job?.name} failed:`, err.message)
})

worker.on('error', (err) => {
  console.error('Worker error:', err)
})

// Schedule recurring jobs for all active businesses
scheduleRecurringJobs().then(() => {
  console.log('📅 Recurring jobs scheduled for all active businesses')
}).catch(console.error)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('Shutting down worker...')
  await worker.close()
  process.exit(0)
})
