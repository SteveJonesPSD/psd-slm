'use server'

import { requirePortalSession } from '@/lib/portal/session'
import { createOnsiteJobItemFromPortal, createEscalation, cancelPortalOnsiteJobItem } from '@/app/(dashboard)/helpdesk/onsite-jobs/actions'
import { getPortalOnsiteJobCategories } from '@/lib/portal/onsite-job-actions'
import type { OjiPriority } from '@/lib/onsite-jobs/types'

export async function createPortalOjiAction(input: {
  subject: string
  description?: string
  room_location?: string
  priority?: OjiPriority
  category_id?: string
  on_behalf_of_name?: string
  preferred_datetime?: string
}): Promise<{ error?: string; refNumber?: string }> {
  const ctx = await requirePortalSession()

  const result = await createOnsiteJobItemFromPortal(
    {
      customer_id: ctx.customerId,
      subject: input.subject,
      description: input.description,
      room_location: input.room_location,
      priority: input.priority,
      category_id: input.category_id,
      on_behalf_of_name: input.on_behalf_of_name,
      preferred_datetime: input.preferred_datetime,
      source_type: 'portal',
      created_by_portal_user_id: ctx.portalUserId,
      requested_by_contact_id: ctx.contactId,
    },
    ctx.orgId,
  )

  if (result.error) return { error: result.error }
  return { refNumber: result.data?.ref_number }
}

export async function createEscalationAction(description: string): Promise<{ error?: string; refNumber?: string }> {
  const ctx = await requirePortalSession()

  const result = await createEscalation({
    customer_id: ctx.customerId,
    description,
    org_id: ctx.orgId,
    created_by_portal_user_id: ctx.portalUserId,
  })

  if (result.error) return { error: result.error }
  return { refNumber: result.data?.ref_number }
}

export async function cancelPortalOjiAction(id: string): Promise<{ error?: string }> {
  const ctx = await requirePortalSession()
  return cancelPortalOnsiteJobItem(id, ctx.portalUserId, ctx.customerId, ctx.orgId)
}

export async function getPortalCategoriesAction() {
  const ctx = await requirePortalSession()
  return getPortalOnsiteJobCategories(ctx)
}
