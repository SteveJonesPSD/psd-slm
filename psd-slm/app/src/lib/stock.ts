import type { SupabaseClient } from '@supabase/supabase-js'

// --- DN number generation ---

export async function generateDnNumber(supabase: SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `DN-${year}-`

  const { data: existing } = await supabase
    .from('delivery_notes')
    .select('dn_number')
    .eq('org_id', orgId)
    .like('dn_number', `${prefix}%`)
    .order('dn_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].dn_number
    const parts = last.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// --- Stock take number generation ---

export async function generateStNumber(supabase: SupabaseClient, orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ST-${year}-`

  const { data: existing } = await supabase
    .from('stock_takes')
    .select('st_number')
    .eq('org_id', orgId)
    .like('st_number', `${prefix}%`)
    .order('st_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].st_number
    const parts = last.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// --- DN status transitions ---

export const DN_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
  delivered: [],
  cancelled: [],
}

export function getDnValidTransitions(currentStatus: string): string[] {
  return DN_VALID_TRANSITIONS[currentStatus] || []
}

// --- Stock take transitions ---

export const ST_VALID_TRANSITIONS: Record<string, string[]> = {
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

// --- Adjustment reasons ---

export const ADJUSTMENT_REASONS = [
  'Return',
  'Damaged',
  'Found',
  'Initial Stock',
  'Warranty Replacement',
  'Other',
] as const

export type AdjustmentReason = typeof ADJUSTMENT_REASONS[number]
