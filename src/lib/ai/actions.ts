import { db } from '@/lib/db'
import type { ModuleType, ActionStatus } from '@/types'

interface CreateActionParams {
  businessId: string
  module: ModuleType
  actionType: string
  title: string
  description?: string
  payload: Record<string, unknown>
  requiresApproval: boolean
  approvalReason?: string
  confidence?: number
  aiReasoning?: string
  status: ActionStatus
  amount?: number // cents
}

export async function createAiAction(params: CreateActionParams) {
  return db.aiAction.create({
    data: {
      businessId: params.businessId,
      module: params.module,
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      payload: params.payload,
      requiresApproval: params.requiresApproval,
      approvalReason: params.approvalReason,
      confidence: params.confidence,
      aiReasoning: params.aiReasoning,
      status: params.status,
      amount: params.amount,
      executedAt: params.status === 'COMPLETED' ? new Date() : undefined,
    },
  })
}

// Check if action needs approval based on business thresholds
export async function needsApproval(
  businessId: string,
  actionType: string,
  amount?: number,
  isNewVendor?: boolean
): Promise<{ required: boolean; reason?: string }> {
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { thresholds: true },
  })

  const thresholds = business.thresholds as Record<string, number>

  if (actionType === 'payroll_run') {
    return { required: true, reason: 'All payroll runs require approval' }
  }

  if (isNewVendor && amount && amount > (thresholds.vendor_new || 100000)) {
    return { required: true, reason: `New vendor payment over threshold ($${(thresholds.vendor_new / 100).toFixed(0)})` }
  }

  if (amount && amount > (thresholds.transaction || 50000)) {
    return { required: true, reason: `Amount exceeds threshold ($${(thresholds.transaction / 100).toFixed(0)})` }
  }

  return { required: false }
}

// Approve an inbox item
export async function approveInboxItem(
  inboxItemId: string,
  userId: string
): Promise<void> {
  const item = await db.inboxItem.findUniqueOrThrow({
    where: { id: inboxItemId },
    include: { action: true },
  })

  await Promise.all([
    db.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        resolvedAt: new Date(),
        resolution: 'approved',
        resolvedBy: userId,
      },
    }),
    db.aiAction.update({
      where: { id: item.actionId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    }),
  ])
}

// Reject an inbox item
export async function rejectInboxItem(
  inboxItemId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const item = await db.inboxItem.findUniqueOrThrow({
    where: { id: inboxItemId },
    include: { action: true },
  })

  await Promise.all([
    db.inboxItem.update({
      where: { id: inboxItemId },
      data: {
        resolvedAt: new Date(),
        resolution: 'rejected',
        resolvedBy: userId,
      },
    }),
    db.aiAction.update({
      where: { id: item.actionId },
      data: {
        status: 'REJECTED',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    }),
  ])
}

// Get inbox items for a business
export async function getInboxItems(businessId: string, resolved = false) {
  return db.inboxItem.findMany({
    where: {
      businessId,
      resolvedAt: resolved ? { not: null } : null,
      dismissed: false,
    },
    include: {
      action: {
        select: {
          id: true,
          actionType: true,
          payload: true,
          aiReasoning: true,
          confidence: true,
          module: true,
        },
      },
    },
    orderBy: [
      { urgency: 'desc' },
      { createdAt: 'desc' },
    ],
  })
}
