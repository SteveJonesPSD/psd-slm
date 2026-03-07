'use client'

import { cn } from '@/lib/utils'

interface BadgeProps {
  label: string
  color: string
  bg: string
  className?: string
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

export function Badge({ label, color, bg: _bg, className }: BadgeProps) {
  const rgb = hexToRgb(color)
  return (
    <span
      className={cn('inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5', className)}
      style={{
        color,
        borderColor: color,
        backgroundColor: `rgba(${rgb}, 0.12)`,
      }}
    >
      {label}
    </span>
  )
}

// Pre-configured badge variants for common statuses
export const STAGE_CONFIG = {
  prospecting: { label: 'Prospecting', color: '#6366f1', bg: '#eef2ff' },
  qualifying: { label: 'Qualifying', color: '#0891b2', bg: '#ecfeff' },
  proposal: { label: 'Proposal', color: '#d97706', bg: '#fffbeb' },
  negotiation: { label: 'Negotiation', color: '#ea580c', bg: '#fff7ed' },
  won: { label: 'Won', color: '#059669', bg: '#ecfdf5' },
  lost: { label: 'Lost', color: '#dc2626', bg: '#fef2f2' },
} as const

export const QUOTE_STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#d97706', bg: '#fffbeb' },
  review: { label: 'Review', color: '#8b5cf6', bg: '#f5f3ff' },
  sent: { label: 'Sent', color: '#2563eb', bg: '#eff6ff' },
  accepted: { label: 'Accepted', color: '#059669', bg: '#ecfdf5' },
  declined: { label: 'Declined', color: '#dc2626', bg: '#fef2f2' },
  expired: { label: 'Expired', color: '#9ca3af', bg: '#f9fafb' },
  superseded: { label: 'Superseded', color: '#64748b', bg: '#f1f5f9' },
  revised: { label: 'Revised', color: '#9ca3af', bg: '#f3f4f6' },
  lost: { label: 'Lost', color: '#dc2626', bg: '#fef2f2' },
} as const

export const QUOTE_TYPE_CONFIG = {
  business: { label: 'Business', color: '#1e293b', bg: '#f1f5f9' },
  education: { label: 'Education', color: '#7c3aed', bg: '#f5f3ff' },
  charity: { label: 'Charity', color: '#059669', bg: '#ecfdf5' },
  public_sector: { label: 'Public Sector', color: '#2563eb', bg: '#eff6ff' },
} as const

export const CUSTOMER_TYPE_CONFIG = {
  education: { label: 'Education', color: '#7c3aed', bg: '#f5f3ff' },
  business: { label: 'Business', color: '#1e293b', bg: '#f1f5f9' },
  charity: { label: 'Charity', color: '#059669', bg: '#ecfdf5' },
} as const

export const FULFILMENT_ROUTE_CONFIG = {
  from_stock: { label: 'From Stock', color: '#059669', bg: '#ecfdf5' },
  drop_ship: { label: 'Drop Ship', color: '#7c3aed', bg: '#f5f3ff' },
} as const

export const TEMPLATE_CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  access_control: { label: 'Access Control', color: '#dc2626', bg: '#fef2f2' },
  environmental: { label: 'Environmental', color: '#059669', bg: '#ecfdf5' },
  networking: { label: 'Networking', color: '#2563eb', bg: '#eff6ff' },
  cabling: { label: 'Cabling', color: '#d97706', bg: '#fffbeb' },
  general: { label: 'General', color: '#6b7280', bg: '#f3f4f6' },
}

export const INBOUND_PO_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  uploading: { label: 'Uploading', color: '#6b7280', bg: '#f3f4f6' },
  extracting: { label: 'Extracting', color: '#8b5cf6', bg: '#f5f3ff' },
  pending_review: { label: 'Pending Review', color: '#d97706', bg: '#fffbeb' },
  matched: { label: 'Matched', color: '#2563eb', bg: '#eff6ff' },
  processing: { label: 'Processing', color: '#0891b2', bg: '#ecfeff' },
  completed: { label: 'Completed', color: '#059669', bg: '#ecfdf5' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2' },
  error: { label: 'Error', color: '#dc2626', bg: '#fef2f2' },
}

export const MATCH_CONFIDENCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  exact: { label: 'Exact', color: '#059669', bg: '#ecfdf5' },
  high: { label: 'High', color: '#2563eb', bg: '#eff6ff' },
  low: { label: 'Low', color: '#d97706', bg: '#fffbeb' },
  none: { label: 'No Match', color: '#6b7280', bg: '#f3f4f6' },
}

export const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: 'Super Admin', color: '#dc2626', bg: '#fef2f2' },
  admin: { label: 'Admin', color: '#2563eb', bg: '#eff6ff' },
  sales: { label: 'Sales', color: '#059669', bg: '#ecfdf5' },
  accounts: { label: 'Accounts', color: '#d97706', bg: '#fffbeb' },
  purchasing: { label: 'Purchasing', color: '#ea580c', bg: '#fff7ed' },
  engineering: { label: 'Engineering', color: '#7c3aed', bg: '#f5f3ff' },
}

export const TICKET_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: '#6366f1', bg: '#eef2ff' },
  open: { label: 'Open', color: '#2563eb', bg: '#eff6ff' },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  waiting_on_customer: { label: 'Waiting on Customer', color: '#7c3aed', bg: '#f5f3ff' },
  escalated: { label: 'Escalated', color: '#dc2626', bg: '#fef2f2' },
  resolved: { label: 'Resolved', color: '#059669', bg: '#ecfdf5' },
  closed: { label: 'Closed', color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { label: 'Cancelled', color: '#9ca3af', bg: '#f9fafb' },
  merged: { label: 'Merged', color: '#64748b', bg: '#f1f5f9' },
}

export const TICKET_PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fef2f2' },
  high: { label: 'High', color: '#d97706', bg: '#fffbeb' },
  medium: { label: 'Medium', color: '#2563eb', bg: '#eff6ff' },
  low: { label: 'Low', color: '#6b7280', bg: '#f3f4f6' },
}

export const TICKET_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  helpdesk: { label: 'Service Desk', color: '#2563eb', bg: '#eff6ff' },
  onsite_job: { label: 'Onsite Job', color: '#059669', bg: '#ecfdf5' },
}

export const CONTRACT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  helpdesk: { label: 'Service Desk', color: '#2563eb', bg: '#eff6ff' },
  onsite: { label: 'Onsite', color: '#059669', bg: '#ecfdf5' },
  both: { label: 'Both', color: '#7c3aed', bg: '#f5f3ff' },
}

export const KB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#d97706', bg: '#fffbeb' },
  published: { label: 'Published', color: '#059669', bg: '#ecfdf5' },
  archived: { label: 'Archived', color: '#d97706', bg: '#fffbeb' },
}

export const SO_HEADER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  confirmed: { label: 'Confirmed', color: '#2563eb', bg: '#eff6ff' },
  in_progress: { label: 'In Progress', color: '#6366f1', bg: '#eef2ff' },
  partially_fulfilled: { label: 'Partially Fulfilled', color: '#d97706', bg: '#fffbeb' },
  fulfilled: { label: 'Fulfilled', color: '#059669', bg: '#ecfdf5' },
  invoiced: { label: 'Invoiced', color: '#7c3aed', bg: '#f5f3ff' },
  part_invoiced: { label: 'Part Invoiced', color: '#9333ea', bg: '#faf5ff' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const SO_LINE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  picked: { label: 'Picked', color: '#2563eb', bg: '#eff6ff' },
  ordered: { label: 'Ordered', color: '#6366f1', bg: '#eef2ff' },
  partial_received: { label: 'Partial Received', color: '#d97706', bg: '#fffbeb' },
  received: { label: 'Received', color: '#0891b2', bg: '#ecfeff' },
  delivered: { label: 'Delivered', color: '#059669', bg: '#ecfdf5' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const DELIVERY_DESTINATION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  psd_office: { label: 'Warehouse', color: '#d97706', bg: '#fffbeb' },
  customer_site: { label: 'Customer Site', color: '#2563eb', bg: '#eff6ff' },
  service: { label: 'Service', color: '#7c3aed', bg: '#f5f3ff' },
}

export const PO_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#d97706', bg: '#fffbeb' },
  sent: { label: 'Sent', color: '#2563eb', bg: '#eff6ff' },
  acknowledged: { label: 'Acknowledged', color: '#6366f1', bg: '#eef2ff' },
  partially_received: { label: 'Partially Received', color: '#d97706', bg: '#fffbeb' },
  received: { label: 'Received', color: '#059669', bg: '#ecfdf5' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const PURCHASE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  stock_order: { label: 'Stock Order', color: '#2563eb', bg: '#eff6ff' },
}

export const PO_LINE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  ordered: { label: 'Ordered', color: '#6366f1', bg: '#eef2ff' },
  partial_received: { label: 'Partial', color: '#d97706', bg: '#fffbeb' },
  received: { label: 'Received', color: '#059669', bg: '#ecfdf5' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unscheduled: { label: 'Unscheduled', color: '#6b7280', bg: '#f3f4f6' },
  scheduled: { label: 'Scheduled', color: '#2563eb', bg: '#eff6ff' },
  travelling: { label: 'Travelling', color: '#d97706', bg: '#fffbeb' },
  on_site: { label: 'On Site', color: '#7c3aed', bg: '#f5f3ff' },
  completed: { label: 'Completed', color: '#059669', bg: '#ecfdf5' },
  return_travelling: { label: 'Returning', color: '#d97706', bg: '#fffbeb' },
  closed: { label: 'Closed', color: '#2563eb', bg: '#eff6ff' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const JOB_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  installation: { label: 'Installation', color: '#059669', bg: '#ecfdf5' },
  maintenance: { label: 'Maintenance', color: '#2563eb', bg: '#eff6ff' },
  reactive: { label: 'Reactive', color: '#dc2626', bg: '#fef2f2' },
  survey: { label: 'Survey', color: '#d97706', bg: '#fffbeb' },
  delivery: { label: 'Delivery', color: '#7c3aed', bg: '#f5f3ff' },
  other: { label: 'Other', color: '#6b7280', bg: '#f3f4f6' },
}

export const JOB_PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: '#6b7280', bg: '#f3f4f6' },
  normal: { label: 'Normal', color: '#2563eb', bg: '#eff6ff' },
  high: { label: 'High', color: '#d97706', bg: '#fffbeb' },
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fef2f2' },
}

export const STOCK_MOVEMENT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  goods_received: { label: 'Goods Received', color: '#059669', bg: '#ecfdf5' },
  allocated: { label: 'Allocated', color: '#2563eb', bg: '#eff6ff' },
  deallocated: { label: 'Deallocated', color: '#6b7280', bg: '#f3f4f6' },
  picked: { label: 'Picked', color: '#6366f1', bg: '#eef2ff' },
  adjustment_in: { label: 'Adjustment In', color: '#0891b2', bg: '#ecfeff' },
  adjustment_out: { label: 'Adjustment Out', color: '#d97706', bg: '#fffbeb' },
  stocktake_adjustment: { label: 'Stocktake Adj.', color: '#7c3aed', bg: '#f5f3ff' },
}

export const DN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#d97706', bg: '#fffbeb' },
  confirmed: { label: 'Confirmed', color: '#2563eb', bg: '#eff6ff' },
  dispatched: { label: 'Dispatched', color: '#6366f1', bg: '#eef2ff' },
  delivered: { label: 'Delivered', color: '#059669', bg: '#ecfdf5' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const STOCK_TAKE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  completed: { label: 'Completed', color: '#059669', bg: '#ecfdf5' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const FULFILMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  needs_action: { label: 'Needs Action', color: '#dc2626', bg: '#fef2f2' },
  covered: { label: 'Covered', color: '#d97706', bg: '#fffbeb' },
  ready: { label: 'Ready', color: '#059669', bg: '#ecfdf5' },
}

export const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#d97706', bg: '#fffbeb' },
  sent: { label: 'Sent', color: '#2563eb', bg: '#eff6ff' },
  paid: { label: 'Paid', color: '#059669', bg: '#ecfdf5' },
  overdue: { label: 'Overdue', color: '#dc2626', bg: '#fef2f2' },
  void: { label: 'Void', color: '#9ca3af', bg: '#f9fafb' },
  credit_note: { label: 'Credit Note', color: '#d97706', bg: '#fffbeb' },
}

export const INVOICE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  standard: { label: 'Standard', color: '#1e293b', bg: '#f1f5f9' },
  proforma: { label: 'Proforma', color: '#7c3aed', bg: '#f5f3ff' },
  credit_note: { label: 'Credit Note', color: '#d97706', bg: '#fffbeb' },
}

export const CONTRACT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#d97706', bg: '#fffbeb' },
  pending_signature: { label: 'Pending Signature', color: '#d97706', bg: '#fffbeb' },
  declined_signature: { label: 'Signature Declined', color: '#dc2626', bg: '#fef2f2' },
  awaiting_activation: { label: 'Awaiting Activation', color: '#2563eb', bg: '#eff6ff' },
  active: { label: 'Active', color: '#059669', bg: '#ecfdf5' },
  renewal_flagged: { label: 'Renewal Due', color: '#d97706', bg: '#fffbeb' },
  renewal_sent: { label: 'Renewal Sent', color: '#2563eb', bg: '#eff6ff' },
  renewal_accepted: { label: 'Renewal Accepted', color: '#0d9488', bg: '#f0fdfa' },
  schedule_pending: { label: 'Schedule Pending', color: '#7c3aed', bg: '#f5f3ff' },
  not_renewing: { label: 'Not Renewing', color: '#dc2626', bg: '#fef2f2' },
  expired: { label: 'Expired', color: '#9ca3af', bg: '#f9fafb' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
  renewed: { label: 'Renewed', color: '#0d9488', bg: '#f0fdfa' },
}

export const CONTRACT_CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  support: { label: 'Support', color: '#64748b', bg: '#f8fafc' },
  service: { label: 'Service', color: '#2563eb', bg: '#eff6ff' },
  licensing: { label: 'Licensing', color: '#7c3aed', bg: '#f5f3ff' },
}

export const RENEWAL_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#059669', bg: '#ecfdf5' },
  alert_180: { label: '180-Day Alert', color: '#d97706', bg: '#fffbeb' },
  alert_90: { label: '90-Day Alert', color: '#dc2626', bg: '#fef2f2' },
  notice_given: { label: 'Notice Given', color: '#d97706', bg: '#fffbeb' },
  renewal_in_progress: { label: 'Renewal In Progress', color: '#2563eb', bg: '#eff6ff' },
  rolling: { label: 'Rolling', color: '#6366f1', bg: '#eef2ff' },
  superseded: { label: 'Superseded', color: '#64748b', bg: '#f8fafc' },
  expired: { label: 'Expired', color: '#dc2626', bg: '#fef2f2' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const ESIGN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_required: { label: 'Not Required', color: '#64748b', bg: '#f8fafc' },
  pending: { label: 'E-Sign Pending', color: '#2563eb', bg: '#eff6ff' },
  signed: { label: 'E-Signed', color: '#059669', bg: '#ecfdf5' },
  waived: { label: 'Waived', color: '#d97706', bg: '#fffbeb' },
}

export const SCHEDULE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#64748b', bg: '#f8fafc' },
  draft_created: { label: 'Draft Created', color: '#d97706', bg: '#fffbeb' },
  sent: { label: 'Sent', color: '#059669', bg: '#ecfdf5' },
  skipped: { label: 'Skipped', color: '#64748b', bg: '#f8fafc' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
}

export const RENEWAL_PERIOD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  april: { label: 'April', color: '#059669', bg: '#ecfdf5' },
  september: { label: 'September', color: '#6366f1', bg: '#eef2ff' },
  custom: { label: 'Custom', color: '#d97706', bg: '#fffbeb' },
}

export const VISIT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#d97706', bg: '#fffbeb' },
  confirmed: { label: 'Confirmed', color: '#059669', bg: '#ecfdf5' },
  completed: { label: 'Completed', color: '#2563eb', bg: '#eff6ff' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
  rescheduled: { label: 'Rescheduled', color: '#7c3aed', bg: '#f5f3ff' },
  bank_holiday_pending: { label: 'Bank Holiday', color: '#d97706', bg: '#fffbeb' },
}

export const GROUP_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  group: { label: 'Group', color: '#6366f1', bg: '#eef2ff' },
  mat: { label: 'MAT', color: '#7c3aed', bg: '#f5f3ff' },
  franchise: { label: 'Franchise', color: '#059669', bg: '#ecfdf5' },
  nhs_trust: { label: 'NHS Trust', color: '#2563eb', bg: '#eff6ff' },
}

export const CALENDAR_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#d97706', bg: '#fffbeb' },
  active: { label: 'Active', color: '#059669', bg: '#ecfdf5' },
  archived: { label: 'Archived', color: '#9ca3af', bg: '#f9fafb' },
}

export const TIME_SLOT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  am: { label: 'AM', color: '#2563eb', bg: '#eff6ff' },
  pm: { label: 'PM', color: '#d97706', bg: '#fffbeb' },
  custom: { label: 'Custom', color: '#059669', bg: '#ecfdf5' },
}
