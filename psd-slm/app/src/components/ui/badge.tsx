'use client'

import { cn } from '@/lib/utils'

interface BadgeProps {
  label: string
  color: string
  bg: string
  className?: string
}

export function Badge({ label, color, bg, className }: BadgeProps) {
  return (
    <span
      className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5', className)}
      style={{ color, backgroundColor: bg }}
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
  draft: { label: 'Draft', color: '#6b7280', bg: '#f3f4f6' },
  review: { label: 'Review', color: '#8b5cf6', bg: '#f5f3ff' },
  sent: { label: 'Sent', color: '#2563eb', bg: '#eff6ff' },
  accepted: { label: 'Accepted', color: '#059669', bg: '#ecfdf5' },
  declined: { label: 'Declined', color: '#dc2626', bg: '#fef2f2' },
  expired: { label: 'Expired', color: '#9ca3af', bg: '#f9fafb' },
  superseded: { label: 'Superseded', color: '#64748b', bg: '#f1f5f9' },
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
  from_stock: { label: 'Ship from Stock', color: '#059669', bg: '#ecfdf5' },
  drop_ship: { label: 'Ship from Supplier', color: '#7c3aed', bg: '#f5f3ff' },
} as const

export const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: 'Super Admin', color: '#dc2626', bg: '#fef2f2' },
  admin: { label: 'Admin', color: '#2563eb', bg: '#eff6ff' },
  sales: { label: 'Sales', color: '#059669', bg: '#ecfdf5' },
  accounts: { label: 'Accounts', color: '#d97706', bg: '#fffbeb' },
  purchasing: { label: 'Purchasing', color: '#ea580c', bg: '#fff7ed' },
  engineering: { label: 'Engineering', color: '#7c3aed', bg: '#f5f3ff' },
}
