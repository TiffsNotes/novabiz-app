// Redis/BullMQ queue disabled - will be enabled when Redis is configured
export const queues: Record<string, any> = {}
export const workers: Record<string, any> = {}
export async function addJob(queue: string, data: any) {
  console.log('Job queued (no-op):', queue, data)
}
