'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { generateStNumber } from '@/lib/stock'

// ============================================================================
// READS
// ============================================================================

export async function getStockLevels() {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_stock_availability')
    .select('*')
    .order('product_name', { ascending: true })

  if (error) {
    console.error('[getStockLevels]', error.message)
    return []
  }

  return data || []
}

export async function getStockMovements(filters?: {
  productId?: string
  movementType?: string
  referenceType?: string
  dateFrom?: string
  dateTo?: string
}) {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('stock_movements')
    .select(`
      *,
      products(id, name, sku),
      stock_locations(id, name, code),
      creator:users!stock_movements_created_by_fkey(id, first_name, last_name, initials, color)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters?.productId) {
    query = query.eq('product_id', filters.productId)
  }
  if (filters?.movementType) {
    query = query.eq('movement_type', filters.movementType)
  }
  if (filters?.referenceType) {
    query = query.eq('reference_type', filters.referenceType)
  }
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getStockMovements]', error.message)
    return []
  }

  return data || []
}

export async function getStockAvailability(productId: string) {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_stock_availability')
    .select('*')
    .eq('product_id', productId)

  if (error) {
    console.error('[getStockAvailability]', error.message)
    return []
  }

  return data || []
}

export async function getSerialNumbers(productId: string, status?: string) {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('serial_number_registry')
    .select('*, products(id, name, sku), stock_locations(id, name, code)')
    .eq('product_id', productId)
    .order('serial_number', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getSerialNumbers]', error.message)
    return []
  }

  return data || []
}

// Check if in_stock serials for a product were received from a PO linked to a specific SO line
export async function getPoLinkedSerials(productId: string, soLineId: string) {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  // Find PO lines linked to this SO line
  const { data: poLines } = await supabase
    .from('purchase_order_lines')
    .select('id, purchase_orders(po_number)')
    .eq('sales_order_line_id', soLineId)
    .eq('product_id', productId)

  if (!poLines || poLines.length === 0) return { serials: [], poNumber: null }

  const poLineIds = poLines.map(pl => pl.id)
  const poNumber = (poLines[0].purchase_orders as { po_number: string } | null)?.po_number || null

  // Find serials in registry that came from these PO lines and are in_stock
  const { data: serials } = await supabase
    .from('serial_number_registry')
    .select('serial_number')
    .eq('product_id', productId)
    .eq('status', 'in_stock')
    .in('po_line_id', poLineIds)

  return {
    serials: (serials || []).map(s => s.serial_number),
    poNumber,
  }
}

export async function getStockLocations() {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('stock_locations')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })

  if (error) {
    console.error('[getStockLocations]', error.message)
    return []
  }

  return data || []
}

export async function getStockTakes() {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('stock_takes')
    .select(`
      *,
      stock_locations(id, name, code),
      starter:users!stock_takes_started_by_fkey(id, first_name, last_name, initials, color),
      stock_take_lines(id)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getStockTakes]', error.message)
    return []
  }

  return data || []
}

export async function getStockTake(id: string) {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  const { data: st, error } = await supabase
    .from('stock_takes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !st) return null

  const [
    { data: location },
    { data: lines },
    { data: starter },
  ] = await Promise.all([
    supabase.from('stock_locations').select('id, name, code').eq('id', st.location_id).single(),
    supabase
      .from('stock_take_lines')
      .select('*, products(id, name, sku, is_serialised)')
      .eq('stock_take_id', id)
      .order('created_at', { ascending: true }),
    st.started_by
      ? supabase.from('users').select('id, first_name, last_name, initials, color').eq('id', st.started_by).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    ...st,
    location,
    lines: lines || [],
    starter,
  }
}

export async function getStockValueReport() {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_stock_availability')
    .select('*')
    .gt('quantity_on_hand', 0)
    .order('category_name', { ascending: true })

  if (error) {
    console.error('[getStockValueReport]', error.message)
    return []
  }

  return data || []
}

// Fulfilment data for SO detail page
export async function getSoFulfilmentData(soId: string) {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  const { data: fulfilmentLines, error: flErr } = await supabase
    .from('v_so_line_fulfilment')
    .select('*')
    .eq('sales_order_id', soId)

  if (flErr) {
    console.error('[getSoFulfilmentData]', flErr.message)
  }

  // Get allocations for this SO
  const { data: allocations, error: allocErr } = await supabase
    .from('stock_allocations')
    .select('*, stock_locations(id, name, code)')
    .in('sales_order_line_id', (fulfilmentLines || []).map(l => l.so_line_id))
    .neq('status', 'cancelled')

  if (allocErr) {
    console.error('[getSoFulfilmentData allocations]', allocErr.message)
  }

  // Get stock availability for SO products
  const productIds = [...new Set((fulfilmentLines || []).map(l => l.product_id).filter(Boolean))]
  let stockAvailability: Record<string, number> = {}
  if (productIds.length > 0) {
    const { data: availability } = await supabase
      .from('v_stock_availability')
      .select('product_id, quantity_available')
      .in('product_id', productIds as string[])

    if (availability) {
      stockAvailability = Object.fromEntries(
        availability.map(a => [a.product_id, a.quantity_available])
      )
    }
  }

  return {
    fulfilmentLines: fulfilmentLines || [],
    allocations: allocations || [],
    stockAvailability,
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

interface AllocateStockInput {
  soLineId: string
  productId: string
  locationId: string
  quantity: number
  serialNumbers?: string[]
}

export async function allocateStock(input: AllocateStockInput) {
  const user = await requirePermission('stock', 'edit')
  const supabase = await createClient()

  // Check available stock
  const { data: stockLevel } = await supabase
    .from('stock_levels')
    .select('quantity_on_hand, quantity_allocated')
    .eq('product_id', input.productId)
    .eq('location_id', input.locationId)
    .single()

  if (!stockLevel) {
    return { error: 'No stock found for this product at this location.' }
  }

  const available = stockLevel.quantity_on_hand - stockLevel.quantity_allocated
  if (input.quantity > available) {
    return { error: `Only ${available} available. Cannot allocate ${input.quantity}.` }
  }

  // Create allocation
  const { data: allocation, error: allocErr } = await supabase
    .from('stock_allocations')
    .insert({
      org_id: user.orgId,
      sales_order_line_id: input.soLineId,
      product_id: input.productId,
      location_id: input.locationId,
      quantity_allocated: input.quantity,
      quantity_picked: 0,
      serial_numbers: input.serialNumbers || [],
      status: 'allocated',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (allocErr || !allocation) {
    return { error: `Failed to create allocation: ${allocErr?.message}` }
  }

  // Adjust stock allocated qty via RPC
  await supabase.rpc('adjust_stock_allocated', {
    p_org_id: user.orgId,
    p_product_id: input.productId,
    p_location_id: input.locationId,
    p_delta: input.quantity,
  })

  // Create movement
  await supabase.from('stock_movements').insert({
    org_id: user.orgId,
    product_id: input.productId,
    location_id: input.locationId,
    movement_type: 'allocated',
    quantity: input.quantity,
    reference_type: 'stock_allocation',
    reference_id: allocation.id,
    serial_numbers: input.serialNumbers || [],
    created_by: user.id,
  })

  // Update serial registry if applicable
  if (input.serialNumbers && input.serialNumbers.length > 0) {
    for (const sn of input.serialNumbers) {
      await supabase
        .from('serial_number_registry')
        .update({ status: 'allocated', so_line_id: input.soLineId })
        .eq('org_id', user.orgId)
        .eq('product_id', input.productId)
        .eq('serial_number', sn)
    }
  }

  // Get SO line info for logging
  const { data: soLine } = await supabase
    .from('sales_order_lines')
    .select('sales_order_id, description')
    .eq('id', input.soLineId)
    .single()

  if (soLine) {
    logActivity({
      supabase,
      user,
      entityType: 'sales_order',
      entityId: soLine.sales_order_id,
      action: 'so.stock_allocated',
      details: {
        so_line_id: input.soLineId,
        product_name: soLine.description,
        quantity: input.quantity,
        serial_numbers: input.serialNumbers,
        allocation_id: allocation.id,
      },
    })

    revalidatePath(`/orders/${soLine.sales_order_id}`)
  }

  revalidatePath('/stock')
  revalidatePath('/stock/movements')

  return { success: true, allocationId: allocation.id }
}

export async function deallocateStock(allocationId: string) {
  const user = await requirePermission('stock', 'edit')
  const supabase = await createClient()

  const { data: allocation, error: allocErr } = await supabase
    .from('stock_allocations')
    .select('*, sales_order_lines(sales_order_id, description)')
    .eq('id', allocationId)
    .single()

  if (allocErr || !allocation) {
    return { error: 'Allocation not found.' }
  }

  if (allocation.status === 'picked' || allocation.status === 'cancelled') {
    return { error: `Cannot deallocate an allocation with status "${allocation.status}".` }
  }

  // Cancel the allocation
  await supabase
    .from('stock_allocations')
    .update({ status: 'cancelled' })
    .eq('id', allocationId)

  // Restore allocated qty
  const qtyToRestore = allocation.quantity_allocated - allocation.quantity_picked
  await supabase.rpc('adjust_stock_allocated', {
    p_org_id: user.orgId,
    p_product_id: allocation.product_id,
    p_location_id: allocation.location_id,
    p_delta: -qtyToRestore,
  })

  // Create movement
  await supabase.from('stock_movements').insert({
    org_id: user.orgId,
    product_id: allocation.product_id,
    location_id: allocation.location_id,
    movement_type: 'deallocated',
    quantity: -qtyToRestore,
    reference_type: 'stock_allocation',
    reference_id: allocationId,
    serial_numbers: allocation.serial_numbers || [],
    created_by: user.id,
  })

  // Reset serial registry
  if (allocation.serial_numbers && allocation.serial_numbers.length > 0) {
    for (const sn of allocation.serial_numbers) {
      await supabase
        .from('serial_number_registry')
        .update({ status: 'in_stock', so_line_id: null })
        .eq('org_id', user.orgId)
        .eq('product_id', allocation.product_id)
        .eq('serial_number', sn)
    }
  }

  const soLine = allocation.sales_order_lines as unknown as { sales_order_id: string; description: string } | null
  if (soLine) {
    logActivity({
      supabase,
      user,
      entityType: 'sales_order',
      entityId: soLine.sales_order_id,
      action: 'so.stock_deallocated',
      details: {
        allocation_id: allocationId,
        product_name: soLine.description,
        quantity_restored: qtyToRestore,
      },
    })

    revalidatePath(`/orders/${soLine.sales_order_id}`)
  }

  revalidatePath('/stock')
  revalidatePath('/stock/movements')

  return { success: true }
}

// Unallocate ALL stock from an SO line — handles both allocated and picked statuses
// Returns serials to in_stock, reverses stock level changes, reverts SO line status
export async function unallocateStockFromSoLine(soLineId: string, reason: string) {
  const user = await requirePermission('stock', 'edit')
  const supabase = await createClient()

  if (!reason || reason.trim().length < 3) {
    return { error: 'A reason is required for unallocation.' }
  }

  // Get all active (non-cancelled) allocations for this SO line
  const { data: allocations, error: allocErr } = await supabase
    .from('stock_allocations')
    .select('*')
    .eq('so_line_id', soLineId)
    .in('status', ['allocated', 'picked'])

  if (allocErr || !allocations || allocations.length === 0) {
    return { error: 'No active allocations found for this line.' }
  }

  // Get the SO line for context
  const { data: soLine } = await supabase
    .from('sales_order_lines')
    .select('id, sales_order_id, description, fulfilment_route, status')
    .eq('id', soLineId)
    .single()

  if (!soLine) {
    return { error: 'SO line not found.' }
  }

  let totalQtyFreed = 0
  const freedSerials: string[] = []

  for (const alloc of allocations) {
    const wasPicked = alloc.status === 'picked'
    const qtyToRestore = alloc.quantity_allocated

    // Cancel the allocation
    await supabase
      .from('stock_allocations')
      .update({ status: 'cancelled' })
      .eq('id', alloc.id)

    if (wasPicked) {
      // Picked items: stock_on_hand was already decremented during pick.
      // We need to add it back AND reduce allocated count
      await supabase.rpc('adjust_stock_on_hand', {
        p_org_id: user.orgId,
        p_product_id: alloc.product_id,
        p_location_id: alloc.location_id,
        p_delta: qtyToRestore,
      })
    }

    // Reduce allocated count (for both allocated and picked — the alloc record still counted)
    await supabase.rpc('adjust_stock_allocated', {
      p_org_id: user.orgId,
      p_product_id: alloc.product_id,
      p_location_id: alloc.location_id,
      p_delta: -qtyToRestore,
    })

    // Create movement
    await supabase.from('stock_movements').insert({
      org_id: user.orgId,
      product_id: alloc.product_id,
      location_id: alloc.location_id,
      movement_type: 'deallocated',
      quantity: -qtyToRestore,
      reference_type: 'stock_allocation',
      reference_id: alloc.id,
      serial_numbers: alloc.serial_numbers || [],
      notes: `Unallocated: ${reason.trim()}`,
      created_by: user.id,
    })

    // Reset serial registry — return to in_stock
    if (alloc.serial_numbers && alloc.serial_numbers.length > 0) {
      for (const sn of alloc.serial_numbers) {
        await supabase
          .from('serial_number_registry')
          .update({ status: 'in_stock', so_line_id: null })
          .eq('org_id', user.orgId)
          .eq('product_id', alloc.product_id)
          .eq('serial_number', sn)
        freedSerials.push(sn)
      }
    }

    totalQtyFreed += qtyToRestore
  }

  // Revert SO line status to pending
  await supabase
    .from('sales_order_lines')
    .update({ status: 'pending' })
    .eq('id', soLineId)

  // Log activity
  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: soLine.sales_order_id,
    action: 'so.stock_unallocated',
    details: {
      so_line_id: soLineId,
      product_name: soLine.description,
      quantity_freed: totalQtyFreed,
      serial_numbers: freedSerials,
      reason: reason.trim(),
    },
  })

  revalidatePath(`/orders/${soLine.sales_order_id}`)
  revalidatePath('/stock')
  revalidatePath('/stock/movements')

  return { success: true, quantityFreed: totalQtyFreed, serialsFreed: freedSerials }
}

interface MarkAsPickedInput {
  allocationIds: string[]
}

export async function markAsPicked(input: MarkAsPickedInput) {
  const user = await requirePermission('stock', 'edit')
  const supabase = await createClient()

  const soIdsToRevalidate = new Set<string>()
  const serialisedSkipped: string[] = []

  for (const allocId of input.allocationIds) {
    const { data: alloc } = await supabase
      .from('stock_allocations')
      .select('*, sales_order_lines(id, sales_order_id, description, quantity, product_id, products(is_serialised, product_type, product_categories(requires_serial)))')
      .eq('id', allocId)
      .single()

    if (!alloc || alloc.status !== 'allocated') continue

    // Serialised items must go through markAsPickedWithSerials() for individual serial selection
    const soLineData = alloc.sales_order_lines as unknown as {
      id: string
      sales_order_id: string
      description: string
      quantity: number
      product_id: string
      products: {
        is_serialised: boolean | null
        product_type?: 'goods' | 'service'
        product_categories?: { requires_serial: boolean } | null
      } | null
    } | null
    const effectivelySerialized = (() => {
      if (!soLineData?.products) return false
      const p = soLineData.products
      if (p.product_type === 'service') return false
      if (p.is_serialised === true) return true
      if (p.is_serialised === false) return false
      return p.product_categories?.requires_serial ?? false
    })()
    if (effectivelySerialized) {
      serialisedSkipped.push(soLineData!.description)
      continue
    }

    const qtyToPick = alloc.quantity_allocated - alloc.quantity_picked

    // Update allocation
    await supabase
      .from('stock_allocations')
      .update({
        quantity_picked: alloc.quantity_allocated,
        status: 'picked',
      })
      .eq('id', allocId)

    // Decrement on_hand AND allocated
    await supabase.rpc('adjust_stock_on_hand', {
      p_org_id: user.orgId,
      p_product_id: alloc.product_id,
      p_location_id: alloc.location_id,
      p_delta: -qtyToPick,
    })
    await supabase.rpc('adjust_stock_allocated', {
      p_org_id: user.orgId,
      p_product_id: alloc.product_id,
      p_location_id: alloc.location_id,
      p_delta: -qtyToPick,
    })

    // Create picked movement
    await supabase.from('stock_movements').insert({
      org_id: user.orgId,
      product_id: alloc.product_id,
      location_id: alloc.location_id,
      movement_type: 'picked',
      quantity: -qtyToPick,
      reference_type: 'stock_allocation',
      reference_id: allocId,
      serial_numbers: alloc.serial_numbers || [],
      created_by: user.id,
    })

    // Check if all allocations for this SO line are picked → transition SO line to 'picked'
    const soLine = soLineData

    if (soLine) {
      soIdsToRevalidate.add(soLine.sales_order_id)

      const { data: allAllocations } = await supabase
        .from('stock_allocations')
        .select('quantity_picked, status')
        .eq('sales_order_line_id', soLine.id)
        .neq('status', 'cancelled')

      if (allAllocations) {
        const totalPicked = allAllocations.reduce((sum, a) => sum + a.quantity_picked, 0)
        if (totalPicked >= soLine.quantity) {
          await supabase
            .from('sales_order_lines')
            .update({ status: 'picked' })
            .eq('id', soLine.id)
        }
      }

      logActivity({
        supabase,
        user,
        entityType: 'sales_order',
        entityId: soLine.sales_order_id,
        action: 'so.stock_picked',
        details: {
          allocation_id: allocId,
          product_name: soLine.description,
          quantity_picked: qtyToPick,
        },
      })
    }
  }

  for (const soId of soIdsToRevalidate) {
    revalidatePath(`/orders/${soId}`)
  }
  revalidatePath('/stock')
  revalidatePath('/stock/movements')
  revalidatePath('/orders')

  if (serialisedSkipped.length > 0) {
    return {
      success: true,
      serialisedSkipped,
      message: `Serialised items require individual serial selection: ${serialisedSkipped.join(', ')}`,
    }
  }

  return { success: true }
}

// --- Pick with specific serial selection (serialised items only) ---

interface MarkAsPickedWithSerialsInput {
  allocationId: string
  pickedSerials: string[]
}

export async function markAsPickedWithSerials(input: MarkAsPickedWithSerialsInput) {
  const user = await requirePermission('stock', 'edit')
  const supabase = await createClient()

  const { data: alloc } = await supabase
    .from('stock_allocations')
    .select('*, sales_order_lines(id, sales_order_id, description, quantity)')
    .eq('id', input.allocationId)
    .single()

  if (!alloc) {
    return { error: 'Allocation not found.' }
  }
  if (alloc.status !== 'allocated') {
    return { error: `Cannot pick an allocation with status "${alloc.status}".` }
  }

  const qtyToPick = alloc.quantity_allocated - alloc.quantity_picked

  // Validate count matches
  if (input.pickedSerials.length !== qtyToPick) {
    return { error: `Expected ${qtyToPick} serial(s) but received ${input.pickedSerials.length}.` }
  }

  // Validate serials exist — check allocation record first, fall back to registry
  const allocatedSerials = alloc.serial_numbers || []
  if (allocatedSerials.length > 0) {
    // Allocation has serials recorded — validate against those
    const allocSet = new Set<string>(allocatedSerials)
    const invalidSerials = input.pickedSerials.filter(sn => !allocSet.has(sn))
    if (invalidSerials.length > 0) {
      return { error: `Serial(s) not in this allocation: ${invalidSerials.join(', ')}` }
    }
  } else {
    // Pre-existing allocation without serial selection — validate serials exist in registry
    const { data: registryEntries } = await supabase
      .from('serial_number_registry')
      .select('serial_number')
      .eq('org_id', user.orgId)
      .eq('product_id', alloc.product_id)
      .in('serial_number', input.pickedSerials)
      .in('status', ['in_stock', 'allocated'])

    const foundSerials = new Set((registryEntries || []).map(e => e.serial_number))
    const invalidSerials = input.pickedSerials.filter(sn => !foundSerials.has(sn))
    if (invalidSerials.length > 0) {
      return { error: `Serial(s) not found in stock: ${invalidSerials.join(', ')}` }
    }

    // Record the serials on the allocation for audit trail
    await supabase
      .from('stock_allocations')
      .update({ serial_numbers: input.pickedSerials })
      .eq('id', input.allocationId)
  }

  // Update allocation to picked
  await supabase
    .from('stock_allocations')
    .update({
      quantity_picked: alloc.quantity_allocated,
      status: 'picked',
    })
    .eq('id', input.allocationId)

  // Decrement on_hand AND allocated
  await supabase.rpc('adjust_stock_on_hand', {
    p_org_id: user.orgId,
    p_product_id: alloc.product_id,
    p_location_id: alloc.location_id,
    p_delta: -qtyToPick,
  })
  await supabase.rpc('adjust_stock_allocated', {
    p_org_id: user.orgId,
    p_product_id: alloc.product_id,
    p_location_id: alloc.location_id,
    p_delta: -qtyToPick,
  })

  // Create picked movement with specific serial numbers
  await supabase.from('stock_movements').insert({
    org_id: user.orgId,
    product_id: alloc.product_id,
    location_id: alloc.location_id,
    movement_type: 'picked',
    quantity: -qtyToPick,
    reference_type: 'stock_allocation',
    reference_id: input.allocationId,
    serial_numbers: input.pickedSerials,
    created_by: user.id,
  })

  // Check if all allocations for this SO line are picked → transition SO line to 'picked'
  const soLine = alloc.sales_order_lines as unknown as {
    id: string
    sales_order_id: string
    description: string
    quantity: number
  } | null

  if (soLine) {
    const { data: allAllocations } = await supabase
      .from('stock_allocations')
      .select('quantity_picked, status')
      .eq('sales_order_line_id', soLine.id)
      .neq('status', 'cancelled')

    if (allAllocations) {
      const totalPicked = allAllocations.reduce((sum, a) => sum + a.quantity_picked, 0)
      if (totalPicked >= soLine.quantity) {
        await supabase
          .from('sales_order_lines')
          .update({ status: 'picked' })
          .eq('id', soLine.id)
      }
    }

    logActivity({
      supabase,
      user,
      entityType: 'sales_order',
      entityId: soLine.sales_order_id,
      action: 'so.stock_picked',
      details: {
        allocation_id: input.allocationId,
        product_name: soLine.description,
        quantity_picked: qtyToPick,
        serial_numbers: input.pickedSerials,
      },
    })

    revalidatePath(`/orders/${soLine.sales_order_id}`)
  }

  revalidatePath('/stock')
  revalidatePath('/stock/movements')
  revalidatePath('/orders')

  return { success: true }
}

interface AdjustStockInput {
  productId: string
  locationId: string
  adjustmentType: 'increase' | 'decrease'
  quantity: number
  reason: string
  notes?: string
  serialNumbers?: string[]
}

export async function adjustStock(input: AdjustStockInput) {
  const user = await requirePermission('stock', 'create')
  const supabase = await createClient()

  if (input.quantity <= 0) {
    return { error: 'Quantity must be greater than zero.' }
  }

  const movementType = input.adjustmentType === 'increase' ? 'adjustment_in' : 'adjustment_out'
  const delta = input.adjustmentType === 'increase' ? input.quantity : -input.quantity

  // Adjust stock on hand
  await supabase.rpc('adjust_stock_on_hand', {
    p_org_id: user.orgId,
    p_product_id: input.productId,
    p_location_id: input.locationId,
    p_delta: delta,
  })

  // Create movement
  await supabase.from('stock_movements').insert({
    org_id: user.orgId,
    product_id: input.productId,
    location_id: input.locationId,
    movement_type: movementType,
    quantity: delta,
    reason: input.reason,
    notes: input.notes || null,
    serial_numbers: input.serialNumbers || [],
    created_by: user.id,
  })

  // Create/update serial registry entries for increases
  if (input.serialNumbers && input.serialNumbers.length > 0) {
    for (const sn of input.serialNumbers) {
      if (input.adjustmentType === 'increase') {
        await supabase.from('serial_number_registry').upsert({
          org_id: user.orgId,
          product_id: input.productId,
          serial_number: sn,
          status: 'in_stock',
          location_id: input.locationId,
          received_at: new Date().toISOString(),
        }, { onConflict: 'org_id,product_id,serial_number' })
      } else {
        await supabase
          .from('serial_number_registry')
          .delete()
          .eq('org_id', user.orgId)
          .eq('product_id', input.productId)
          .eq('serial_number', sn)
      }
    }
  }

  // Get product name for logging
  const { data: product } = await supabase
    .from('products')
    .select('name, sku')
    .eq('id', input.productId)
    .single()

  logActivity({
    supabase,
    user,
    entityType: 'stock',
    entityId: input.productId,
    action: `stock.${movementType}`,
    details: {
      product_name: product?.name,
      sku: product?.sku,
      quantity: input.quantity,
      direction: input.adjustmentType,
      reason: input.reason,
      notes: input.notes,
      serial_numbers: input.serialNumbers,
    },
  })

  revalidatePath('/stock')
  revalidatePath('/stock/movements')

  return { success: true }
}

interface CreateStockTakeInput {
  locationId: string
  categoryFilter?: string
}

export async function createStockTake(input: CreateStockTakeInput) {
  const user = await requirePermission('stock', 'create')
  const supabase = await createClient()

  const stNumber = await generateStNumber(supabase, user.orgId)

  // Create the stock take header
  const { data: st, error: stErr } = await supabase
    .from('stock_takes')
    .insert({
      org_id: user.orgId,
      st_number: stNumber,
      location_id: input.locationId,
      status: 'in_progress',
      started_by: user.id,
    })
    .select('id')
    .single()

  if (stErr || !st) {
    return { error: `Failed to create stock take: ${stErr?.message}` }
  }

  // Snapshot current stock levels into lines
  let query = supabase
    .from('stock_levels')
    .select('product_id, quantity_on_hand')
    .eq('location_id', input.locationId)
    .eq('org_id', user.orgId)

  const { data: levels } = await query

  if (levels && levels.length > 0) {
    // Filter by category if specified
    let filteredLevels = levels
    if (input.categoryFilter) {
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', input.categoryFilter)

      if (products) {
        const productIds = new Set(products.map(p => p.id))
        filteredLevels = levels.filter(l => productIds.has(l.product_id))
      }
    }

    const stLines = filteredLevels.map(level => ({
      stock_take_id: st.id,
      product_id: level.product_id,
      expected_qty: level.quantity_on_hand,
    }))

    if (stLines.length > 0) {
      await supabase.from('stock_take_lines').insert(stLines)
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'stock_take',
    entityId: st.id,
    action: 'stocktake.created',
    details: { st_number: stNumber, location_id: input.locationId },
  })

  revalidatePath('/stock/takes')

  return { success: true, id: st.id, stNumber }
}

export async function updateStockTakeCount(lineId: string, countedQty: number, serialsFound?: string[]) {
  await requirePermission('stock', 'edit')
  const supabase = await createClient()

  const { error } = await supabase
    .from('stock_take_lines')
    .update({
      counted_qty: countedQty,
      serials_found: serialsFound || [],
    })
    .eq('id', lineId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function completeStockTake(stockTakeId: string) {
  const user = await requirePermission('stock', 'edit')
  const supabase = await createClient()

  // Fetch stock take + lines
  const { data: st } = await supabase
    .from('stock_takes')
    .select('id, org_id, location_id, status, st_number')
    .eq('id', stockTakeId)
    .single()

  if (!st || st.status !== 'in_progress') {
    return { error: 'Stock take not found or already completed.' }
  }

  const { data: lines } = await supabase
    .from('stock_take_lines')
    .select('*')
    .eq('stock_take_id', stockTakeId)

  if (!lines) {
    return { error: 'No stock take lines found.' }
  }

  // Check all lines have been counted
  const uncounted = lines.filter(l => l.counted_qty === null)
  if (uncounted.length > 0) {
    return { error: `${uncounted.length} line(s) have not been counted yet.` }
  }

  // Apply variances
  for (const line of lines) {
    const variance = (line.counted_qty ?? 0) - line.expected_qty
    if (variance !== 0) {
      // Adjust stock
      await supabase.rpc('adjust_stock_on_hand', {
        p_org_id: st.org_id,
        p_product_id: line.product_id,
        p_location_id: st.location_id,
        p_delta: variance,
      })

      // Create adjustment movement
      await supabase.from('stock_movements').insert({
        org_id: st.org_id,
        product_id: line.product_id,
        location_id: st.location_id,
        movement_type: 'stocktake_adjustment',
        quantity: variance,
        reference_type: 'stock_take',
        reference_id: stockTakeId,
        notes: `Stock take ${st.st_number}: expected ${line.expected_qty}, counted ${line.counted_qty}`,
        created_by: user.id,
      })
    }
  }

  // Complete the stock take
  await supabase
    .from('stock_takes')
    .update({
      status: 'completed',
      completed_by: user.id,
      completed_at: new Date().toISOString(),
    })
    .eq('id', stockTakeId)

  logActivity({
    supabase,
    user,
    entityType: 'stock_take',
    entityId: stockTakeId,
    action: 'stocktake.completed',
    details: {
      st_number: st.st_number,
      total_lines: lines.length,
      lines_with_variance: lines.filter(l => (l.counted_qty ?? 0) !== l.expected_qty).length,
    },
  })

  revalidatePath('/stock/takes')
  revalidatePath(`/stock/takes/${stockTakeId}`)
  revalidatePath('/stock')
  revalidatePath('/stock/movements')

  return { success: true }
}

export async function cancelStockTake(stockTakeId: string) {
  const user = await requirePermission('stock', 'edit')
  const supabase = await createClient()

  const { data: st } = await supabase
    .from('stock_takes')
    .select('id, status, st_number')
    .eq('id', stockTakeId)
    .single()

  if (!st || st.status !== 'in_progress') {
    return { error: 'Stock take not found or not in progress.' }
  }

  await supabase
    .from('stock_takes')
    .update({ status: 'cancelled' })
    .eq('id', stockTakeId)

  logActivity({
    supabase,
    user,
    entityType: 'stock_take',
    entityId: stockTakeId,
    action: 'stocktake.cancelled',
    details: { st_number: st.st_number },
  })

  revalidatePath('/stock/takes')
  revalidatePath(`/stock/takes/${stockTakeId}`)

  return { success: true }
}

// ============================================================================
// SEED DATA
// ============================================================================

export async function seedStockData() {
  const user = await requirePermission('stock', 'create')
  const supabase = await createClient()

  // Check if stock data already exists
  const { data: existingLocations } = await supabase
    .from('stock_locations')
    .select('id')
    .eq('org_id', user.orgId)
    .limit(1)

  if (existingLocations && existingLocations.length > 0) {
    return { error: 'Stock data already exists. Seed is idempotent — skipping.' }
  }

  // 1. Create default location
  const { data: location, error: locErr } = await supabase
    .from('stock_locations')
    .insert({
      org_id: user.orgId,
      name: 'PSD Office',
      code: 'MAIN',
      is_default: true,
      is_active: true,
      address: 'PSD Group, Unit 4, Wakefield Road, Huddersfield, HD5 8DJ',
    })
    .select('id')
    .single()

  if (locErr || !location) {
    return { error: `Failed to create location: ${locErr?.message}` }
  }

  // 2. Find stocked products
  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name, is_serialised, default_buy_price')
    .eq('org_id', user.orgId)
    .eq('is_stocked', true)
    .eq('is_active', true)
    .order('sku')

  if (!products || products.length === 0) {
    return { error: 'No stocked products found. Please seed products first.' }
  }

  // Stock quantities by SKU pattern
  const stockMap: Record<string, { qty: number; reorder: number; serials?: string[] }> = {
    'ES-PRO': { qty: 15, reorder: 5, serials: Array.from({ length: 15 }, (_, i) => `ES-PRO-${String(i + 1).padStart(4, '0')}`) },
    'ES-SC': { qty: 8, reorder: 3, serials: Array.from({ length: 8 }, (_, i) => `ES-SC-${String(i + 1).padStart(4, '0')}`) },
    'IE-BLE': { qty: 10, reorder: 4, serials: Array.from({ length: 10 }, (_, i) => `IE-BLE-${String(i + 1).padStart(4, '0')}`) },
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let levelsCreated = 0
  let serialsCreated = 0

  for (const product of products) {
    // Find matching stock config by SKU prefix
    const skuPrefix = Object.keys(stockMap).find(prefix => product.sku.startsWith(prefix))
    const config = skuPrefix ? stockMap[skuPrefix] : { qty: 5, reorder: 2 }

    // Create stock level
    await supabase.from('stock_levels').insert({
      org_id: user.orgId,
      product_id: product.id,
      location_id: location.id,
      quantity_on_hand: config.qty,
      quantity_allocated: 0,
      reorder_point: config.reorder,
    })
    levelsCreated++

    // Create adjustment_in movement
    await supabase.from('stock_movements').insert({
      org_id: user.orgId,
      product_id: product.id,
      location_id: location.id,
      movement_type: 'adjustment_in',
      quantity: config.qty,
      reason: 'Initial Stock',
      notes: 'Seed data — initial stock count',
      created_by: user.id,
      created_at: weekAgo,
    })

    // Create serial numbers if serialised
    if (config.serials && product.is_serialised) {
      for (const sn of config.serials) {
        await supabase.from('serial_number_registry').insert({
          org_id: user.orgId,
          product_id: product.id,
          serial_number: sn,
          status: 'in_stock',
          location_id: location.id,
          received_at: weekAgo,
        })
        serialsCreated++
      }
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'stock',
    entityId: location.id,
    action: 'stock.seeded',
    details: {
      location: 'PSD Office (MAIN)',
      levels_created: levelsCreated,
      serials_created: serialsCreated,
    },
  })

  revalidatePath('/stock')
  revalidatePath('/stock/movements')

  return { success: true, levelsCreated, serialsCreated }
}
