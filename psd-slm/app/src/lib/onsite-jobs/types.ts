export type OjiStatus = 'pending' | 'in_progress' | 'complete' | 'escalated' | 'cancelled'
export type OjiPriority = 'low' | 'medium' | 'high' | 'urgent'
export type OjiSourceType = 'portal' | 'ticket_push' | 'internal' | 'escalation'
export type OjiAuditAction =
  | 'created' | 'status_changed' | 'note_added' | 'engineer_note'
  | 'sales_notified' | 'ticket_pushed_to' | 'ticket_closed_source'
  | 'escalated' | 'visit_linked' | 'cancelled'
export type OjiActorType = 'portal_user' | 'internal_user' | 'system'

export const OJI_STATUSES: OjiStatus[] = ['pending', 'in_progress', 'complete', 'escalated', 'cancelled']
export const OJI_PRIORITIES: OjiPriority[] = ['low', 'medium', 'high', 'urgent']

export const PRIORITY_SORT_ORDER: Record<OjiPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const STATUS_TRANSITIONS: Record<OjiStatus, OjiStatus[]> = {
  pending: ['in_progress', 'escalated', 'cancelled'],
  in_progress: ['complete', 'escalated', 'cancelled'],
  complete: [],
  escalated: ['in_progress', 'cancelled'],
  cancelled: [],
}

export function canTransition(from: OjiStatus, to: OjiStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export const OJI_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'In Progress', color: '#1e40af', bg: '#dbeafe' },
  complete: { label: 'Complete', color: '#166534', bg: '#dcfce7' },
  escalated: { label: 'Escalated', color: '#991b1b', bg: '#fee2e2' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6' },
}

export const OJI_PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#991b1b', bg: '#fee2e2' },
  high: { label: 'High', color: '#9a3412', bg: '#ffedd5' },
  medium: { label: 'Medium', color: '#92400e', bg: '#fef3c7' },
  low: { label: 'Low', color: '#6b7280', bg: '#f3f4f6' },
}

export interface OnsiteJobCategory {
  id: string
  org_id: string
  name: string
  colour: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface OnsiteJobItem {
  id: string
  org_id: string
  ref_number: string
  customer_id: string
  visit_instance_id: string | null
  source_type: OjiSourceType
  source_ticket_id: string | null
  subject: string
  description: string | null
  room_location: string | null
  priority: OjiPriority
  category_id: string | null
  requested_by_contact_id: string | null
  on_behalf_of_name: string | null
  on_behalf_of_contact_id: string | null
  preferred_datetime: string | null
  status: OjiStatus
  engineer_notes: string | null
  completed_at: string | null
  completed_by: string | null
  notify_sales_at: string | null
  escalation_ticket_id: string | null
  created_by_portal_user_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  customer?: { id: string; name: string }
  category?: OnsiteJobCategory | null
  requested_by_contact?: { id: string; first_name: string; last_name: string } | null
  completed_by_user?: { id: string; first_name: string; last_name: string } | null
  visit_instance?: { id: string; visit_date: string; start_time: string | null } | null
  source_ticket?: { id: string; ticket_number: string; subject: string } | null
}

export interface OnsiteJobAuditEntry {
  id: string
  onsite_job_item_id: string
  action: OjiAuditAction
  old_value: string | null
  new_value: string | null
  note: string | null
  actor_type: OjiActorType
  actor_portal_user_id: string | null
  actor_user_id: string | null
  created_at: string
  actor_user?: { id: string; first_name: string; last_name: string } | null
  actor_portal_user?: { id: string; contact_id: string; contacts?: { first_name: string; last_name: string } } | null
}

export interface CreateOjiInput {
  customer_id: string
  subject: string
  description?: string
  room_location?: string
  priority?: OjiPriority
  category_id?: string
  requested_by_contact_id?: string
  on_behalf_of_name?: string
  on_behalf_of_contact_id?: string
  preferred_datetime?: string
  source_type: OjiSourceType
  source_ticket_id?: string
  created_by_user_id?: string
  created_by_portal_user_id?: string
}

export interface PushTicketToOjiInput {
  ticket_id: string
  subject: string
  description?: string
  room_location?: string
  priority?: OjiPriority
  category_id?: string
}
