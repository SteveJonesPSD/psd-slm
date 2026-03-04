import type { TicketStatus, TicketPriority } from '@/types/database'

export const TICKET_STATUSES: TicketStatus[] = [
  'new', 'open', 'in_progress', 'waiting_on_customer',
  'escalated', 'resolved', 'closed', 'cancelled',
]

export const ACTIVE_STATUSES: TicketStatus[] = [
  'new', 'open', 'in_progress', 'waiting_on_customer', 'escalated',
]

export const CLOSED_STATUSES: TicketStatus[] = ['resolved', 'closed', 'cancelled']

export const TICKET_PRIORITIES: TicketPriority[] = ['urgent', 'high', 'medium', 'low']

export const PRIORITY_SORT_ORDER: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** Valid status transitions from a given status */
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ['open', 'in_progress', 'waiting_on_customer', 'cancelled'],
  open: ['in_progress', 'waiting_on_customer', 'escalated', 'resolved', 'cancelled'],
  in_progress: ['waiting_on_customer', 'escalated', 'resolved', 'cancelled'],
  waiting_on_customer: ['open', 'in_progress', 'escalated', 'resolved', 'cancelled'],
  escalated: ['in_progress', 'waiting_on_customer', 'resolved', 'cancelled'],
  resolved: ['open', 'closed'],
  closed: ['open'],
  cancelled: [],
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/** Ticket number format: TKT-YYYY-NNNN */
export function formatTicketNumber(year: number, seq: number): string {
  return `TKT-${year}-${String(seq).padStart(4, '0')}`
}
