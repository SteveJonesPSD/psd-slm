'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { generateDnNumber, getDnValidTransitions } from '@/lib/stock'

// ============================================================================
// READS
// ============================================================================

export async function getDeliveryNotes() {
  const user = await requirePermission('delivery_notes', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('delivery_notes')
    .select(`
      *,
      sales_orders!inner(id, so_number, customer_id, customers(id, name)),
      delivery_note_lines(id, quantity),
      creator:users!delivery_notes_created_by_fkey(id, first_name, last_name, initials, color)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getDeliveryNotes]', error.message)
    return []
  }

  return data || []
}

export async function getDeliveryNote(id: string) {
  await requirePermission('delivery_notes', 'view')
  const supabase = await createClient()

  const { data: dn, error } = await supabase
    .from('delivery_notes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !dn) return null

  const [
    { data: salesOrder },
    { data: lines },
    { data: creator },
    { data: activities },
  ] = await Promise.all([
    supabase.from('sales_orders').select('id, so_number, customer_id, customers(id, name)').eq('id', dn.sales_order_id).single(),
    supabase
      .from('delivery_note_lines')
      .select('*, products(id, name, sku)')
      .eq('delivery_note_id', id)
      .order('created_at', { ascending: true }),
    dn.created_by
      ? supabase.from('users').select('id, first_name, last_name, initials, color').eq('id', dn.created_by).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('activity_log')
      .select('*, users:user_id(first_name, last_name, initials, color)')
      .eq('entity_type', 'delivery_note')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return {
    ...dn,
    salesOrder,
    lines: lines || [],
    creator,
    activities: activities || [],
  }
}

export async function getDeliveryNotesForSo(soId: string) {
  await requirePermission('delivery_notes', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('delivery_notes')
    .select('id, dn_number, status, carrier, tracking_reference, created_at, delivery_note_lines(id, quantity)')
    .eq('sales_order_id', soId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getDeliveryNotesForSo]', error.message)
    return []
  }

  return data || []
}

// ============================================================================
// MUTATIONS
// ============================================================================

interface CreateDnInput {
  soId: string
  lines: {
    soLineId: string
    productId: string | null
    description: string
    quantity: number
    serialNumbers?: string[]
  }[]
  deliveryAddressLine1?: string
  deliveryAddressLine2?: string
  deliveryCity?: string
  deliveryPostcode?: string
  carrier?: string
  trackingReference?: string
  notes?: string
}

export async function createDeliveryNote(input: CreateDnInput) {
  const user = await requirePermission('delivery_notes', 'create')
  const supabase = await createClient()

  if (input.lines.length === 0) {
    return { error: 'At least one line is required.' }
  }

  const dnNumber = await generateDnNumber(supabase, user.orgId)

  // Create DN header
  const { data: dn, error: dnErr } = await supabase
    .from('delivery_notes')
    .insert({
      org_id: user.orgId,
      sales_order_id: input.soId,
      dn_number: dnNumber,
      status: 'draft',
      delivery_address_line1: input.deliveryAddressLine1 || null,
      delivery_address_line2: input.deliveryAddressLine2 || null,
      delivery_city: input.deliveryCity || null,
      delivery_postcode: input.deliveryPostcode || null,
      carrier: input.carrier || null,
      tracking_reference: input.trackingReference || null,
      notes: input.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (dnErr || !dn) {
    return { error: `Failed to create delivery note: ${dnErr?.message}` }
  }

  // Create DN lines
  const dnLines = input.lines.map(line => ({
    delivery_note_id: dn.id,
    sales_order_line_id: line.soLineId,
    product_id: line.productId,
    description: line.description,
    quantity: line.quantity,
    serial_numbers: line.serialNumbers || [],
  }))

  const { error: linesErr } = await supabase
    .from('delivery_note_lines')
    .insert(dnLines)

  if (linesErr) {
    // Cleanup header on line failure
    await supabase.from('delivery_notes').delete().eq('id', dn.id)
    return { error: `Failed to create DN lines: ${linesErr.message}` }
  }

  // Get SO number for logging
  const { data: so } = await supabase
    .from('sales_orders')
    .select('so_number')
    .eq('id', input.soId)
    .single()

  logActivity({
    supabase,
    user,
    entityType: 'delivery_note',
    entityId: dn.id,
    action: 'dn.created',
    details: {
      dn_number: dnNumber,
      so_id: input.soId,
      so_number: so?.so_number,
      line_count: input.lines.length,
    },
  })

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: input.soId,
    action: 'so.dn_created',
    details: {
      dn_id: dn.id,
      dn_number: dnNumber,
      line_count: input.lines.length,
    },
  })

  revalidatePath(`/delivery-notes/${dn.id}`)
  revalidatePath('/delivery-notes')
  revalidatePath(`/orders/${input.soId}`)
  revalidatePath('/orders')

  return { success: true, id: dn.id, dnNumber }
}

export async function updateDnStatus(dnId: string, newStatus: string) {
  const user = await requirePermission('delivery_notes', 'edit')
  const supabase = await createClient()

  const { data: dn, error: dnErr } = await supabase
    .from('delivery_notes')
    .select('id, dn_number, status, sales_order_id')
    .eq('id', dnId)
    .single()

  if (dnErr || !dn) {
    return { error: 'Delivery note not found.' }
  }

  const validTransitions = getDnValidTransitions(dn.status)
  if (!validTransitions.includes(newStatus)) {
    return { error: `Cannot transition from ${dn.status} to ${newStatus}.` }
  }

  const updates: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'confirmed') {
    updates.confirmed_at = new Date().toISOString()
  }
  if (newStatus === 'dispatched') {
    updates.dispatched_at = new Date().toISOString()

    // Update serial registry to dispatched
    const { data: dnLines } = await supabase
      .from('delivery_note_lines')
      .select('serial_numbers, product_id')
      .eq('delivery_note_id', dnId)

    if (dnLines) {
      for (const line of dnLines) {
        const serials = line.serial_numbers as string[] | null
        if (serials && serials.length > 0 && line.product_id) {
          for (const sn of serials) {
            await supabase
              .from('serial_number_registry')
              .update({
                status: 'dispatched',
                delivery_note_id: dnId,
                dispatched_at: new Date().toISOString(),
              })
              .eq('product_id', line.product_id)
              .eq('serial_number', sn)
          }
        }
      }
    }
  }
  if (newStatus === 'delivered') {
    updates.delivered_at = new Date().toISOString()

    // Cascade SO line statuses to delivered
    const { data: dnLines } = await supabase
      .from('delivery_note_lines')
      .select('sales_order_line_id')
      .eq('delivery_note_id', dnId)

    if (dnLines) {
      const soLineIds = dnLines
        .map(l => l.sales_order_line_id)
        .filter(Boolean) as string[]

      if (soLineIds.length > 0) {
        await supabase
          .from('sales_order_lines')
          .update({ status: 'delivered' })
          .in('id', soLineIds)

        logActivity({
          supabase,
          user,
          entityType: 'sales_order',
          entityId: dn.sales_order_id,
          action: 'so.lines_delivered',
          details: {
            dn_number: dn.dn_number,
            line_count: soLineIds.length,
            source: 'delivery_note',
          },
        })
      }
    }
  }

  const { error: updateErr } = await supabase
    .from('delivery_notes')
    .update(updates)
    .eq('id', dnId)

  if (updateErr) {
    return { error: updateErr.message }
  }

  const actionMap: Record<string, string> = {
    confirmed: 'dn.confirmed',
    dispatched: 'dn.dispatched',
    delivered: 'dn.delivered',
    cancelled: 'dn.cancelled',
  }

  logActivity({
    supabase,
    user,
    entityType: 'delivery_note',
    entityId: dnId,
    action: actionMap[newStatus] || `dn.status_changed`,
    details: {
      dn_number: dn.dn_number,
      from_status: dn.status,
      to_status: newStatus,
    },
  })

  revalidatePath(`/delivery-notes/${dnId}`)
  revalidatePath('/delivery-notes')
  revalidatePath(`/orders/${dn.sales_order_id}`)
  revalidatePath('/orders')

  return { success: true }
}
