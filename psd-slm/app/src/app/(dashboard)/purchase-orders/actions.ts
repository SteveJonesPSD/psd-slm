'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { generatePoNumber } from '@/lib/sales-orders'
import { resolveSerialisedStatus } from '@/lib/products'

// --- List ---

export async function getPurchaseOrders() {
  const user = await requirePermission('purchase_orders', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      suppliers(id, name),
      sales_orders(id, so_number, customer_id, customers(id, name)),
      purchase_order_lines(id, quantity, unit_cost, status),
      creator:users!purchase_orders_created_by_fkey(id, first_name, last_name, initials, color)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getPurchaseOrders]', error.message)
    return []
  }

  return data || []
}

// --- Detail ---

export async function getPurchaseOrder(id: string) {
  await requirePermission('purchase_orders', 'view')
  const supabase = await createClient()

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !po) return null

  const [
    { data: supplier },
    { data: salesOrder },
    { data: lines },
    { data: creator },
    { data: activities },
  ] = await Promise.all([
    supabase.from('suppliers').select('id, name').eq('id', po.supplier_id).single(),
    po.sales_order_id
      ? supabase.from('sales_orders').select('id, so_number, customer_id, customers(id, name)').eq('id', po.sales_order_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('purchase_order_lines')
      .select('*, products(id, name, sku, is_serialised, product_type, product_categories(requires_serial)), sales_order_lines(id, buy_price, sell_price, quantity, fulfilment_route, delivery_destination)')
      .eq('purchase_order_id', id)
      .order('sort_order', { ascending: true }),
    po.created_by
      ? supabase.from('users').select('id, first_name, last_name, initials, color').eq('id', po.created_by).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('activity_log')
      .select('*, users:user_id(first_name, last_name, initials, color)')
      .eq('entity_type', 'purchase_order')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return {
    ...po,
    supplier,
    salesOrder,
    lines: lines || [],
    creator,
    activities: activities || [],
  }
}

// --- Generate POs from SO ---

interface GeneratePOsInput {
  soId: string
  lineIds: string[] // specific SO line IDs to generate POs for
}

export async function generatePurchaseOrders(input: GeneratePOsInput) {
  const user = await requirePermission('purchase_orders', 'create')
  const supabase = await createClient()

  // Fetch the SO
  const { data: so, error: soErr } = await supabase
    .from('sales_orders')
    .select('*, customers(id, name, address_line1, address_line2, city, postcode)')
    .eq('id', input.soId)
    .single()

  if (soErr || !so) {
    return { error: 'Sales order not found.' }
  }

  // Check customer PO number is present (required before PO generation)
  if (!so.customer_po) {
    return { error: 'Customer PO number is required before generating purchase orders. Please add the customer PO number to the sales order first.' }
  }

  // Fetch the specified SO lines
  const { data: soLines, error: linesErr } = await supabase
    .from('sales_order_lines')
    .select('*, suppliers(id, name)')
    .eq('sales_order_id', input.soId)
    .in('id', input.lineIds)

  if (linesErr || !soLines || soLines.length === 0) {
    return { error: 'No eligible lines found.' }
  }

  // Validate all lines are eligible (pending, non-service goods lines)
  const ineligible = soLines.filter(
    (l) => l.status !== 'pending' || l.is_service
  )
  if (ineligible.length > 0) {
    return { error: `${ineligible.length} line(s) are not eligible for PO generation (must be pending, non-service).` }
  }

  const noSupplier = soLines.filter((l) => !l.supplier_id)
  if (noSupplier.length > 0) {
    return { error: `${noSupplier.length} line(s) have no supplier assigned. Assign a supplier before generating POs.` }
  }

  // Query stock allocations and existing PO lines to calculate the balance to order
  const soLineIds = soLines.map((l) => l.id)

  const [{ data: stockAllocs }, { data: existingPoLines }] = await Promise.all([
    supabase
      .from('stock_allocations')
      .select('sales_order_line_id, quantity_allocated')
      .in('sales_order_line_id', soLineIds)
      .neq('status', 'cancelled'),
    supabase
      .from('purchase_order_lines')
      .select('sales_order_line_id, quantity, purchase_orders!inner(status)')
      .in('sales_order_line_id', soLineIds)
      .neq('status', 'cancelled')
      .neq('purchase_orders.status', 'cancelled'),
  ])

  // Sum allocated qty per SO line
  const allocatedMap = new Map<string, number>()
  for (const alloc of stockAllocs || []) {
    const prev = allocatedMap.get(alloc.sales_order_line_id) || 0
    allocatedMap.set(alloc.sales_order_line_id, prev + alloc.quantity_allocated)
  }

  // Sum existing PO qty per SO line
  const onPoMap = new Map<string, number>()
  for (const pol of existingPoLines || []) {
    const prev = onPoMap.get(pol.sales_order_line_id) || 0
    onPoMap.set(pol.sales_order_line_id, prev + pol.quantity)
  }

  // Calculate the quantity to order per SO line (balance after stock allocation and existing POs)
  const poQtyMap = new Map<string, number>()
  for (const line of soLines) {
    const allocated = allocatedMap.get(line.id) || 0
    const onPo = onPoMap.get(line.id) || 0
    const balance = Math.max(0, line.quantity - allocated - onPo)
    poQtyMap.set(line.id, balance)
  }

  // Filter out lines that have no balance to order
  const linesWithBalance = soLines.filter((l) => (poQtyMap.get(l.id) || 0) > 0)
  if (linesWithBalance.length === 0) {
    return { error: 'All selected lines are fully covered by stock allocations and existing POs.' }
  }

  // Group by supplier_id + delivery_destination
  const groups = new Map<string, { supplier_id: string; supplier_name: string; delivery_destination: string; lines: typeof soLines }>()
  for (const line of linesWithBalance) {
    const dest = line.delivery_destination || 'psd_office'
    const key = `${line.supplier_id}__${dest}`
    if (!groups.has(key)) {
      const supplierName = (line.suppliers as unknown as { name: string } | null)?.name || 'Unknown'
      groups.set(key, {
        supplier_id: line.supplier_id,
        supplier_name: supplierName,
        delivery_destination: dest,
        lines: [],
      })
    }
    groups.get(key)!.lines.push(line)
  }

  const createdPOs: { id: string; poNumber: string; supplierName: string; lineCount: number; total: number }[] = []

  // Create POs for each group
  for (const batch of groups.values()) {
    const poNumber = await generatePoNumber(supabase, user.orgId)

    // Determine delivery address
    let addressLine1 = null, addressLine2 = null, city = null, postcode = null
    if (batch.delivery_destination === 'customer_site') {
      const customer = so.customers as unknown as { address_line1?: string; address_line2?: string; city?: string; postcode?: string } | null
      addressLine1 = customer?.address_line1 || so.delivery_address_line1
      addressLine2 = customer?.address_line2 || so.delivery_address_line2
      city = customer?.city || so.delivery_city
      postcode = customer?.postcode || so.delivery_postcode
    }

    // Create PO
    const { data: newPo, error: poErr } = await supabase
      .from('purchase_orders')
      .insert({
        org_id: user.orgId,
        sales_order_id: input.soId,
        supplier_id: batch.supplier_id,
        po_number: poNumber,
        status: 'draft',
        purchase_type: 'customer_order',
        delivery_destination: batch.delivery_destination,
        delivery_address_line1: addressLine1,
        delivery_address_line2: addressLine2,
        delivery_city: city,
        delivery_postcode: postcode,
        delivery_cost: 0,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (poErr || !newPo) {
      console.error('[generatePurchaseOrders]', poErr?.message)
      return { error: `Failed to create PO for ${batch.supplier_name}: ${poErr?.message}` }
    }

    // Create PO lines (using balance qty after stock allocations)
    const poLines = batch.lines.map((soLine, i) => ({
      purchase_order_id: newPo.id,
      sales_order_line_id: soLine.id,
      product_id: soLine.product_id,
      sort_order: i + 1,
      description: soLine.description,
      quantity: poQtyMap.get(soLine.id) || soLine.quantity,
      unit_cost: soLine.buy_price,
      quantity_received: 0,
      serial_numbers: [],
      status: 'pending',
    }))

    const { error: polErr } = await supabase
      .from('purchase_order_lines')
      .insert(poLines)

    if (polErr) {
      console.error('[generatePurchaseOrders] lines', polErr.message)
      await supabase.from('purchase_orders').delete().eq('id', newPo.id)
      return { error: `Failed to create PO lines for ${batch.supplier_name}: ${polErr.message}` }
    }

    // Update SO line statuses to 'ordered'
    const soLineIds = batch.lines.map((l) => l.id)
    await supabase
      .from('sales_order_lines')
      .update({ status: 'ordered' })
      .in('id', soLineIds)

    const total = batch.lines.reduce((sum, l) => sum + (poQtyMap.get(l.id) || l.quantity) * l.buy_price, 0)

    createdPOs.push({
      id: newPo.id,
      poNumber,
      supplierName: batch.supplier_name,
      lineCount: batch.lines.length,
      total,
    })

    // Log activity on PO
    logActivity({
      supabase,
      user,
      entityType: 'purchase_order',
      entityId: newPo.id,
      action: 'po.created',
      details: {
        so_id: input.soId,
        so_number: so.so_number,
        supplier_id: batch.supplier_id,
        supplier_name: batch.supplier_name,
        line_count: batch.lines.length,
        total_cost: total,
      },
    })

    // Log activity on SO
    logActivity({
      supabase,
      user,
      entityType: 'sales_order',
      entityId: input.soId,
      action: 'so.po_generated',
      details: {
        po_id: newPo.id,
        po_number: poNumber,
        supplier_name: batch.supplier_name,
        line_count: batch.lines.length,
      },
    })
  }

  revalidatePath(`/orders/${input.soId}`)
  revalidatePath('/orders')
  revalidatePath('/purchase-orders')

  return { success: true, purchaseOrders: createdPOs }
}

// --- Update PO status ---

export async function updatePoStatus(poId: string, newStatus: 'sent' | 'acknowledged' | 'cancelled') {
  const user = await requirePermission('purchase_orders', 'edit')
  const supabase = await createClient()

  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, supplier_id, sales_order_id, suppliers(name)')
    .eq('id', poId)
    .single()

  if (poErr || !po) {
    return { error: 'Purchase order not found.' }
  }

  // Validate transitions
  const validTransitions: Record<string, string[]> = {
    draft: ['sent', 'cancelled'],
    sent: ['acknowledged', 'cancelled'],
    acknowledged: ['cancelled'],
    partially_received: ['cancelled'],
  }

  const allowed = validTransitions[po.status] || []
  if (!allowed.includes(newStatus)) {
    return { error: `Cannot transition from ${po.status} to ${newStatus}.` }
  }

  const updates: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'sent') {
    updates.sent_at = new Date().toISOString()
    // Update all PO line statuses from pending to ordered
    await supabase
      .from('purchase_order_lines')
      .update({ status: 'ordered' })
      .eq('purchase_order_id', poId)
      .eq('status', 'pending')
  }

  if (newStatus === 'cancelled') {
    // Cancel all non-received PO lines
    await supabase
      .from('purchase_order_lines')
      .update({ status: 'cancelled' })
      .eq('purchase_order_id', poId)
      .not('status', 'in', '("received")')
  }

  const { error: updateErr } = await supabase
    .from('purchase_orders')
    .update(updates)
    .eq('id', poId)

  if (updateErr) {
    return { error: updateErr.message }
  }

  const supplierName = (po.suppliers as unknown as { name: string } | null)?.name || 'Unknown'

  logActivity({
    supabase,
    user,
    entityType: 'purchase_order',
    entityId: poId,
    action: newStatus === 'sent' ? 'po.sent' : newStatus === 'acknowledged' ? 'po.acknowledged' : 'po.cancelled',
    details: {
      po_number: po.po_number,
      supplier_name: supplierName,
      ...(newStatus === 'cancelled' ? { cancelled_by: `${user.firstName} ${user.lastName}` } : {}),
      ...(newStatus === 'sent' ? { sent_by: `${user.firstName} ${user.lastName}` } : {}),
    },
  })

  revalidatePath(`/purchase-orders/${poId}`)
  revalidatePath('/purchase-orders')
  if (po.sales_order_id) {
    revalidatePath(`/orders/${po.sales_order_id}`)
  }

  return { success: true }
}

// --- Receive goods on PO line ---

interface ReceivePoGoodsInput {
  poId: string
  lineId: string
  quantityReceived: number
  serialNumbers: string[]
}

export async function receivePoGoods(input: ReceivePoGoodsInput) {
  const user = await requirePermission('purchase_orders', 'edit')
  const supabase = await createClient()

  // Fetch PO
  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, sales_order_id')
    .eq('id', input.poId)
    .single()

  if (poErr || !po) {
    return { error: 'Purchase order not found.' }
  }

  if (!['sent', 'acknowledged', 'partially_received'].includes(po.status)) {
    return { error: `Cannot receive goods on a PO with status "${po.status}".` }
  }

  // Fetch PO line
  const { data: line, error: lineErr } = await supabase
    .from('purchase_order_lines')
    .select('*, products(id, name, sku, is_serialised, product_type, product_categories(requires_serial))')
    .eq('id', input.lineId)
    .eq('purchase_order_id', input.poId)
    .single()

  if (lineErr || !line) {
    return { error: 'PO line not found.' }
  }

  if (['received', 'cancelled'].includes(line.status)) {
    return { error: `Cannot receive goods on a line with status "${line.status}".` }
  }

  // Validate quantity
  const totalAfter = line.quantity_received + input.quantityReceived
  if (input.quantityReceived <= 0) {
    return { error: 'Quantity must be greater than zero.' }
  }
  if (totalAfter > line.quantity) {
    return { error: `Cannot receive ${input.quantityReceived} — only ${line.quantity - line.quantity_received} remaining.` }
  }

  // Resolve serialisation using tri-state logic
  const product = line.products as unknown as {
    id: string; is_serialised: boolean | null; product_type: string;
    product_categories: { requires_serial: boolean } | null
  } | null
  const requiresSerials = product
    ? resolveSerialisedStatus(product.is_serialised, product.product_categories?.requires_serial ?? false, product.product_type as 'goods' | 'service')
    : false

  // Enforce serial count match for serialised items
  if (requiresSerials && input.serialNumbers.length !== input.quantityReceived) {
    return { error: `Expected ${input.quantityReceived} serial number(s) but received ${input.serialNumbers.length}. Serialised items require serial numbers to complete receiving.` }
  }

  // Self-duplicate check within submitted serials
  if (input.serialNumbers.length > 0) {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const sn of input.serialNumbers) {
      if (seen.has(sn)) dupes.push(sn)
      seen.add(sn)
    }
    if (dupes.length > 0) {
      return { error: `Duplicate serial number(s) in submission: ${[...new Set(dupes)].join(', ')}` }
    }

    // Same-PO cross-line check
    const { data: siblingLines } = await supabase
      .from('purchase_order_lines')
      .select('serial_numbers')
      .eq('purchase_order_id', input.poId)
      .eq('product_id', line.product_id)
      .neq('id', input.lineId)

    if (siblingLines) {
      const existingOnPo = siblingLines.flatMap((l) => l.serial_numbers || [])
      const crossDupes = input.serialNumbers.filter((sn) => existingOnPo.includes(sn))
      if (crossDupes.length > 0) {
        return { error: `Serial number(s) already received on another line of this PO: ${crossDupes.join(', ')}` }
      }
    }
  }

  // Check serial uniqueness against registry
  if (input.serialNumbers.length > 0 && requiresSerials) {
    const { data: existing } = await supabase
      .from('serial_number_registry')
      .select('serial_number')
      .eq('org_id', user.orgId)
      .eq('product_id', line.product_id)
      .in('serial_number', input.serialNumbers)

    if (existing && existing.length > 0) {
      const dupes = existing.map(e => e.serial_number).join(', ')
      return { error: `Duplicate serial number(s) already in system: ${dupes}` }
    }
  }

  // Update PO line
  const newLineStatus = totalAfter >= line.quantity ? 'received' : 'partial_received'
  const allSerials = [...(line.serial_numbers || []), ...input.serialNumbers]

  const { error: updateLineErr } = await supabase
    .from('purchase_order_lines')
    .update({
      quantity_received: totalAfter,
      serial_numbers: allSerials,
      status: newLineStatus,
      ...(newLineStatus === 'received' ? { received_at: new Date().toISOString() } : {}),
    })
    .eq('id', input.lineId)

  if (updateLineErr) {
    return { error: updateLineErr.message }
  }

  // Update PO header status
  const { data: allLines } = await supabase
    .from('purchase_order_lines')
    .select('status')
    .eq('purchase_order_id', input.poId)

  if (allLines) {
    const activeLines = allLines.filter((l) => l.status !== 'cancelled')
    const allReceived = activeLines.every((l) => l.status === 'received')
    const someReceived = activeLines.some((l) => l.status === 'received' || l.status === 'partial_received')

    let newPoStatus = po.status
    if (allReceived) {
      newPoStatus = 'received'
    } else if (someReceived) {
      newPoStatus = 'partially_received'
    }

    if (newPoStatus !== po.status) {
      // Auto-acknowledge if transitioning from 'sent' — receiving implies acknowledgement
      const wasSent = po.status === 'sent'

      await supabase
        .from('purchase_orders')
        .update({
          status: newPoStatus,
          ...(newPoStatus === 'received' ? { received_at: new Date().toISOString() } : {}),
        })
        .eq('id', input.poId)

      if (wasSent) {
        logActivity({
          supabase,
          user,
          entityType: 'purchase_order',
          entityId: input.poId,
          action: 'po.acknowledged',
          details: {
            po_number: po.po_number,
            source: 'auto_on_receive',
          },
        })
      }
    }
  }

  let autoAllocated = false
  const isCustomerOrder = !!po.sales_order_id && !!line.sales_order_line_id

  // CASCADE to SO line (only for customer order POs with linked SO)
  if (isCustomerOrder) {
    const { data: soLine } = await supabase
      .from('sales_order_lines')
      .select('id, status, description, fulfilment_route, delivery_destination')
      .eq('id', line.sales_order_line_id)
      .single()

    if (soLine) {
      const newSoLineStatus = newLineStatus === 'received' ? 'received' : 'partial_received'
      await supabase
        .from('sales_order_lines')
        .update({
          quantity_received: totalAfter,
          serial_numbers_received: allSerials,
          status: newSoLineStatus,
        })
        .eq('id', soLine.id)

      // Log on SO
      logActivity({
        supabase,
        user,
        entityType: 'sales_order',
        entityId: po.sales_order_id!,
        action: 'so.line_status_changed',
        details: {
          line_id: soLine.id,
          product_name: line.description,
          from_status: soLine.status,
          to_status: newSoLineStatus,
          source: 'po_receiving',
          po_number: po.po_number,
        },
      })
    }
  }

  // STOCK WIRING
  if (line.product_id) {
    const { data: defaultLocation } = await supabase
      .from('stock_locations')
      .select('id')
      .eq('org_id', user.orgId)
      .eq('is_default', true)
      .limit(1)
      .single()

    if (defaultLocation) {
      // Always: increase stock on hand (audit trail)
      await supabase.rpc('adjust_stock_on_hand', {
        p_org_id: user.orgId,
        p_product_id: line.product_id,
        p_location_id: defaultLocation.id,
        p_delta: input.quantityReceived,
      })

      // Always: create goods_received movement
      const isDirectShip = isCustomerOrder && (await supabase
        .from('purchase_orders')
        .select('delivery_destination')
        .eq('id', input.poId)
        .single()).data?.delivery_destination === 'customer_site'

      await supabase.from('stock_movements').insert({
        org_id: user.orgId,
        product_id: line.product_id,
        location_id: defaultLocation.id,
        movement_type: 'goods_received',
        quantity: input.quantityReceived,
        reference_type: 'purchase_order_line',
        reference_id: input.lineId,
        serial_numbers: input.serialNumbers.length > 0 ? input.serialNumbers : [],
        notes: `PO ${po.po_number} goods received${isDirectShip ? ' (direct ship)' : ''}`,
        created_by: user.id,
      })

      if (isCustomerOrder) {
        // AUTO-ALLOCATE: PO is linked to an SO — serials go straight to 'allocated'
        if (input.serialNumbers.length > 0) {
          const registryRows = input.serialNumbers.map(sn => ({
            org_id: user.orgId,
            product_id: line.product_id,
            serial_number: sn,
            status: 'allocated',
            location_id: defaultLocation.id,
            po_line_id: input.lineId,
            so_line_id: line.sales_order_line_id,
            received_at: new Date().toISOString(),
          }))
          const { error: regErr } = await supabase
            .from('serial_number_registry')
            .insert(registryRows)
          if (regErr) {
            console.error('[receivePoGoods] serial registry insert (auto-allocate)', regErr.message)
            return { error: `Failed to register serial numbers: ${regErr.message}` }
          }
        }

        // Create stock allocation record
        const { error: allocErr } = await supabase.from('stock_allocations').insert({
          org_id: user.orgId,
          product_id: line.product_id,
          location_id: defaultLocation.id,
          sales_order_line_id: line.sales_order_line_id,
          quantity_allocated: input.quantityReceived,
          quantity_picked: 0,
          serial_numbers: input.serialNumbers.length > 0 ? input.serialNumbers : [],
          status: 'allocated',
        })

        if (allocErr) {
          console.error('[receivePoGoods] auto-allocate', allocErr.message)
        }

        // Increase allocated count
        await supabase.rpc('adjust_stock_allocated', {
          p_org_id: user.orgId,
          p_product_id: line.product_id,
          p_location_id: defaultLocation.id,
          p_delta: input.quantityReceived,
        })

        // Create allocation movement
        await supabase.from('stock_movements').insert({
          org_id: user.orgId,
          product_id: line.product_id,
          location_id: defaultLocation.id,
          movement_type: 'allocated',
          quantity: input.quantityReceived,
          reference_type: 'purchase_order_line',
          reference_id: input.lineId,
          serial_numbers: input.serialNumbers.length > 0 ? input.serialNumbers : [],
          notes: `Auto-allocated to SO on PO receipt`,
          created_by: user.id,
        })

        autoAllocated = true
      } else {
        // STOCK ORDER: No SO link — serials go to 'in_stock' for general inventory
        if (input.serialNumbers.length > 0) {
          const registryRows = input.serialNumbers.map(sn => ({
            org_id: user.orgId,
            product_id: line.product_id,
            serial_number: sn,
            status: 'in_stock',
            location_id: defaultLocation.id,
            po_line_id: input.lineId,
            received_at: new Date().toISOString(),
          }))
          const { error: regErr } = await supabase
            .from('serial_number_registry')
            .insert(registryRows)
          if (regErr) {
            console.error('[receivePoGoods] serial registry insert (stock order)', regErr.message)
            return { error: `Failed to register serial numbers: ${regErr.message}` }
          }
        }
      }
    }
  }

  // Log on PO
  logActivity({
    supabase,
    user,
    entityType: 'purchase_order',
    entityId: input.poId,
    action: 'po.goods_received',
    details: {
      line_id: input.lineId,
      product_name: line.description,
      qty_received: input.quantityReceived,
      total_received: totalAfter,
      serials: input.serialNumbers.length > 0 ? input.serialNumbers : undefined,
      received_by: `${user.firstName} ${user.lastName}`,
    },
  })

  revalidatePath(`/purchase-orders/${input.poId}`)
  revalidatePath('/purchase-orders')
  if (po.sales_order_id) {
    revalidatePath(`/orders/${po.sales_order_id}`)
  }
  revalidatePath('/orders')
  revalidatePath('/stock')
  revalidatePath('/stock/movements')

  return { success: true, newLineStatus, autoAllocated }
}

// --- Update line cost (draft POs only) ---

export async function updatePoLineCost(poId: string, lineId: string, newCost: number) {
  const user = await requirePermission('purchase_orders', 'edit')
  const supabase = await createClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', poId)
    .single()

  if (!po || po.status !== 'draft') {
    return { error: 'Unit cost can only be edited on draft POs.' }
  }

  const { data: line } = await supabase
    .from('purchase_order_lines')
    .select('id, description, unit_cost')
    .eq('id', lineId)
    .eq('purchase_order_id', poId)
    .single()

  if (!line) {
    return { error: 'PO line not found.' }
  }

  const oldCost = line.unit_cost

  const { error } = await supabase
    .from('purchase_order_lines')
    .update({ unit_cost: newCost })
    .eq('id', lineId)

  if (error) {
    return { error: error.message }
  }

  if (oldCost !== newCost) {
    logActivity({
      supabase,
      user,
      entityType: 'purchase_order',
      entityId: poId,
      action: 'po.price_adjusted',
      details: {
        line_id: lineId,
        product_name: line.description,
        old_cost: oldCost,
        new_cost: newCost,
        adjusted_by: `${user.firstName} ${user.lastName}`,
      },
    })
  }

  revalidatePath(`/purchase-orders/${poId}`)
  return { success: true }
}

// --- Update delivery cost ---

export async function updatePoDeliveryCost(poId: string, deliveryCost: number) {
  const user = await requirePermission('purchase_orders', 'edit')
  const supabase = await createClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', poId)
    .single()

  if (!po || po.status !== 'draft') {
    return { error: 'Delivery cost can only be edited on draft POs.' }
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ delivery_cost: deliveryCost })
    .eq('id', poId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/purchase-orders/${poId}`)
  return { success: true }
}

// --- Update PO fields (supplier ref, expected date, delivery instructions) ---

export async function updatePoField(poId: string, field: string, value: string | null) {
  const user = await requirePermission('purchase_orders', 'edit')
  const supabase = await createClient()

  const allowedFields = ['supplier_ref', 'expected_delivery_date', 'delivery_instructions']
  if (!allowedFields.includes(field)) {
    return { error: 'Invalid field.' }
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ [field]: value })
    .eq('id', poId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/purchase-orders/${poId}`)
  return { success: true }
}

// --- Get POs for a sales order ---

export async function getPurchaseOrdersForSo(soId: string) {
  await requirePermission('purchase_orders', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      id, po_number, status, delivery_destination, delivery_cost,
      suppliers(id, name),
      purchase_order_lines(id, sales_order_line_id, quantity, unit_cost, status)
    `)
    .eq('sales_order_id', soId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getPurchaseOrdersForSo]', error.message)
    return []
  }

  return data || []
}

// --- Get PO line for an SO line ---

export async function getPoLineForSoLine(soLineId: string) {
  await requirePermission('purchase_orders', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('purchase_order_lines')
    .select('id, purchase_order_id, purchase_orders(po_number)')
    .eq('sales_order_line_id', soLineId)
    .limit(1)
    .maybeSingle()

  return data
}

// --- Create Stock Order (PO with no SO link) ---

interface StockOrderLineInput {
  productId: string
  description: string
  quantity: number
  unitCost: number
}

interface CreateStockOrderInput {
  supplierId: string
  expectedDeliveryDate: string | null
  deliveryInstructions: string | null
  notes: string | null
  lines: StockOrderLineInput[]
}

export async function createStockOrder(input: CreateStockOrderInput) {
  let user
  try {
    user = await requirePermission('purchase_orders', 'create')
  } catch {
    return { error: 'Unauthorized' }
  }
  const supabase = await createClient()

  if (!input.supplierId) {
    return { error: 'Supplier is required.' }
  }
  if (!input.lines || input.lines.length === 0) {
    return { error: 'At least one line is required.' }
  }

  let poNumber: string
  try {
    poNumber = await generatePoNumber(supabase, user.orgId)
  } catch (e) {
    console.error('[createStockOrder] PO number generation failed', e)
    return { error: 'Failed to generate PO number.' }
  }

  // Create PO header (no SO link)
  const { data: newPo, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      org_id: user.orgId,
      sales_order_id: null,
      supplier_id: input.supplierId,
      po_number: poNumber,
      status: 'draft',
      purchase_type: 'stock_order',
      delivery_destination: 'psd_office',
      delivery_cost: 0,
      expected_delivery_date: input.expectedDeliveryDate,
      delivery_instructions: input.deliveryInstructions,
      notes: input.notes,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (poErr || !newPo) {
    console.error('[createStockOrder]', poErr?.message)
    return { error: `Failed to create stock order: ${poErr?.message}` }
  }

  // Create PO lines (no SO line references)
  const poLines = input.lines.map((line, i) => ({
    purchase_order_id: newPo.id,
    sales_order_line_id: null,
    product_id: line.productId,
    sort_order: i + 1,
    description: line.description,
    quantity: line.quantity,
    unit_cost: line.unitCost,
    quantity_received: 0,
    serial_numbers: [],
    status: 'pending',
  }))

  const { error: polErr } = await supabase
    .from('purchase_order_lines')
    .insert(poLines)

  if (polErr) {
    console.error('[createStockOrder] lines', polErr.message)
    await supabase.from('purchase_orders').delete().eq('id', newPo.id)
    return { error: `Failed to create stock order lines: ${polErr.message}` }
  }

  const total = input.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0)

  logActivity({
    supabase,
    user,
    entityType: 'purchase_order',
    entityId: newPo.id,
    action: 'po.created',
    details: {
      purchase_type: 'stock_order',
      supplier_id: input.supplierId,
      line_count: input.lines.length,
      total_cost: total,
    },
  })

  revalidatePath('/purchase-orders')

  return { success: true, poId: newPo.id, poNumber }
}

// --- Seed data ---

export async function seedPurchaseOrders() {
  const user = await requirePermission('purchase_orders', 'create')
  const supabase = await createClient()

  // Check if any POs already exist
  const { data: existingPos } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('org_id', user.orgId)
    .limit(1)

  if (existingPos && existingPos.length > 0) {
    return { error: 'Purchase orders already exist. Seed data is idempotent — skipping.' }
  }

  // Find the first SO
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id, so_number, customer_id, delivery_address_line1, delivery_address_line2, delivery_city, delivery_postcode')
    .eq('org_id', user.orgId)
    .order('created_at')
    .limit(1)

  if (!salesOrders || salesOrders.length === 0) {
    return { error: 'No sales orders found. Please seed sales orders first.' }
  }

  const so = salesOrders[0]

  // Get SO lines that are drop_ship and not service
  const { data: soLines } = await supabase
    .from('sales_order_lines')
    .select('*, suppliers(id, name), products(id, name, sku, is_serialised)')
    .eq('sales_order_id', so.id)
    .eq('fulfilment_route', 'drop_ship')
    .eq('is_service', false)

  if (!soLines || soLines.length === 0) {
    return { error: 'No eligible SO lines found for PO seeding.' }
  }

  // Group by supplier
  const groups = new Map<string, typeof soLines>()
  for (const line of soLines) {
    if (!line.supplier_id) continue
    const key = line.supplier_id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(line)
  }

  let poCount = 0
  for (const [supplierId, lines] of groups.entries()) {
    const supplierName = (lines[0].suppliers as unknown as { name: string } | null)?.name || 'Unknown'
    const poNumber = await generatePoNumber(supabase, user.orgId)
    const dest = lines[0].delivery_destination || 'customer_site'

    // Determine PO status based on SO line statuses
    const lineStatuses = lines.map((l) => l.status)
    const allReceived = lineStatuses.every((s) => ['received', 'delivered'].includes(s))
    const someReceived = lineStatuses.some((s) => ['partial_received', 'received', 'delivered'].includes(s))

    let poStatus = 'sent'
    let sentAt: string | null = '2026-02-22T09:00:00Z'
    let receivedAt: string | null = null
    if (allReceived) {
      poStatus = 'received'
      receivedAt = '2026-03-08T14:30:00Z'
    } else if (someReceived) {
      poStatus = 'partially_received'
    }

    const { data: newPo, error: poErr } = await supabase
      .from('purchase_orders')
      .insert({
        org_id: user.orgId,
        sales_order_id: so.id,
        supplier_id: supplierId,
        po_number: poNumber,
        status: poStatus,
        delivery_destination: dest,
        delivery_address_line1: so.delivery_address_line1,
        delivery_address_line2: so.delivery_address_line2,
        delivery_city: so.delivery_city,
        delivery_postcode: so.delivery_postcode,
        delivery_cost: poCount === 1 ? 8.50 : 0,
        created_by: user.id,
        sent_at: sentAt,
        received_at: receivedAt,
        supplier_ref: poCount === 0 ? 'UI-ORD-88421' : 'EXL-456712',
        expected_delivery_date: poCount === 0 ? '2026-03-12' : '2026-03-08',
      })
      .select('id')
      .single()

    if (poErr || !newPo) {
      console.error('[seedPurchaseOrders]', poErr?.message)
      return { error: `Failed to create seed PO: ${poErr?.message}` }
    }

    // Create PO lines
    const poLines = lines.map((soLine, i) => {
      const qtyReceived = soLine.quantity_received || 0
      let lineStatus = 'ordered'
      if (qtyReceived >= soLine.quantity) lineStatus = 'received'
      else if (qtyReceived > 0) lineStatus = 'partial_received'

      return {
        purchase_order_id: newPo.id,
        sales_order_line_id: soLine.id,
        product_id: soLine.product_id,
        sort_order: i + 1,
        description: soLine.description,
        quantity: soLine.quantity,
        unit_cost: soLine.buy_price,
        quantity_received: qtyReceived,
        serial_numbers: soLine.serial_numbers_received || [],
        status: lineStatus,
        received_at: lineStatus === 'received' ? '2026-03-08T14:30:00Z' : null,
      }
    })

    const { error: polErr } = await supabase
      .from('purchase_order_lines')
      .insert(poLines)

    if (polErr) {
      console.error('[seedPurchaseOrders] lines', polErr.message)
    }

    // Log activity
    logActivity({
      supabase,
      user,
      entityType: 'purchase_order',
      entityId: newPo.id,
      action: 'po.created',
      details: {
        so_id: so.id,
        so_number: so.so_number,
        supplier_name: supplierName,
        line_count: lines.length,
        seeded: true,
      },
    })

    poCount++
  }

  revalidatePath('/purchase-orders')
  revalidatePath('/orders')

  return { success: true, count: poCount }
}
