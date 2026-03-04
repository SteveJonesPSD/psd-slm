import type { SupabaseClient } from '@supabase/supabase-js'

// --- Derived header status (NEVER stored in DB) ---

export type SoHeaderStatus = 'pending' | 'confirmed' | 'in_progress' | 'partially_fulfilled' | 'fulfilled' | 'cancelled'
export type SoDisplayStatus = SoHeaderStatus | 'invoiced' | 'part_invoiced'
export type SoLineStatus = 'pending' | 'picked' | 'ordered' | 'partial_received' | 'received' | 'delivered' | 'cancelled'

export function deriveSoStatus(lines: { status: string }[]): SoHeaderStatus {
  if (lines.length === 0) return 'pending'

  const statuses = lines.map((l) => l.status)
  const allCancelled = statuses.every((s) => s === 'cancelled')
  if (allCancelled) return 'cancelled'

  // Filter out cancelled lines for fulfilment assessment
  const active = statuses.filter((s) => s !== 'cancelled')
  if (active.length === 0) return 'cancelled'

  const allDelivered = active.every((s) => s === 'delivered')
  if (allDelivered) return 'fulfilled'

  const allPending = active.every((s) => s === 'pending')
  if (allPending) return 'pending'

  // Any mix of statuses where at least one is delivered
  const someDelivered = active.some((s) => s === 'delivered')
  const someNotDelivered = active.some((s) => s !== 'delivered')
  if (someDelivered && someNotDelivered) return 'partially_fulfilled'

  // At least one line has progressed past pending
  return 'in_progress'
}

// --- Display status (overlays invoicing state on top of fulfilment) ---

export function deriveSoDisplayStatus(
  lines: { status: string; quantity?: number; quantity_invoiced?: number }[],
): SoDisplayStatus {
  const fulfilmentStatus = deriveSoStatus(lines)
  if (fulfilmentStatus === 'cancelled' || fulfilmentStatus === 'pending') return fulfilmentStatus

  const activeLines = lines.filter((l) => l.status !== 'cancelled')
  if (activeLines.length === 0) return fulfilmentStatus

  const allFullyInvoiced = activeLines.every(
    (l) => ((l.quantity_invoiced || 0) >= (l.quantity || 0)),
  )
  const someInvoiced = activeLines.some((l) => (l.quantity_invoiced || 0) > 0)

  if (allFullyInvoiced) return 'invoiced'
  if (someInvoiced) return 'part_invoiced'

  return fulfilmentStatus
}

// --- SO number generation ---

export async function generateSoNumber(supabase: SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `SO-${year}-`

  const { data: existing } = await supabase
    .from('sales_orders')
    .select('so_number')
    .eq('org_id', orgId)
    .like('so_number', `${prefix}%`)
    .order('so_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].so_number
    const parts = last.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// --- PO number generation ---

export async function generatePoNumber(supabase: SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PO-${year}-`

  const { data: existing } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .eq('org_id', orgId)
    .like('po_number', `${prefix}%`)
    .order('po_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].po_number
    const parts = last.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// --- Line status transitions ---

// From-stock lines: pending → picked → delivered
// Drop-ship lines: pending → ordered → partial_received → received → picked (if warehouse) → delivered
// Service items: pending → delivered (simplified path)
// Any non-terminal line can be cancelled
export const VALID_LINE_TRANSITIONS: Record<string, Record<string, string[]>> = {
  from_stock: {
    pending: ['picked', 'cancelled'],
    picked: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  },
  drop_ship: {
    pending: ['ordered', 'cancelled'],
    ordered: ['partial_received', 'received', 'cancelled'],
    partial_received: ['received', 'cancelled'],
    received: ['picked', 'delivered', 'cancelled'],
    picked: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  },
  service: {
    pending: ['delivered'],
    delivered: [],
    cancelled: [],
  },
}

export function getValidTransitions(
  fulfilmentRoute: string,
  currentStatus: string,
  isService?: boolean,
  deliveryDestination?: string | null,
): string[] {
  const key = isService ? 'service' : fulfilmentRoute
  const routeMap = VALID_LINE_TRANSITIONS[key]
  if (!routeMap) return []
  const transitions = routeMap[currentStatus] || []

  // For drop_ship lines in "received" status, the next step depends on delivery destination:
  // - Warehouse: must be picked before delivery (received → picked → delivered)
  // - Customer site: supplier delivered direct (received → delivered)
  if (key === 'drop_ship' && currentStatus === 'received' && deliveryDestination) {
    if (deliveryDestination === 'psd_office') {
      return transitions.filter(t => t !== 'delivered')
    }
    if (deliveryDestination === 'customer_site') {
      return transitions.filter(t => t !== 'picked')
    }
  }

  return transitions
}

// Detect if a product should be treated as a service item
export function isServiceItem(product: { is_stocked: boolean; is_serialised: boolean | null } | null): boolean {
  if (!product) return false
  return !product.is_stocked && (product.is_serialised === false || product.is_serialised === null)
}
