'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth, hasAnyPermission } from '@/lib/auth'
import { decryptCustomerRow, decryptContactRow } from '@/lib/crypto-helpers'
import type { AuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { generateSoNumber, getValidTransitions, isServiceItem } from '@/lib/sales-orders'

// Cross-domain operations (receiving, picking, line status changes) can be done
// by anyone with edit permissions on sales orders, purchase orders, or stock.
async function requireSoOperationPermission(): Promise<AuthUser> {
  const user = await requireAuth()
  if (hasAnyPermission(user, [
    { module: 'sales_orders', action: 'edit' },
    { module: 'purchase_orders', action: 'edit' },
    { module: 'stock', action: 'edit' },
  ])) {
    return user
  }
  throw new Error('Permission denied: requires sales_orders.edit, purchase_orders.edit, or stock.edit')
}

// --- Suppliers (for editable supplier dropdown) ---

export async function getActiveSuppliers() {
  const user = await requirePermission('sales_orders', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('name')

  return data || []
}

export async function getProductSuppliersForSo(soId: string) {
  const user = await requirePermission('sales_orders', 'view')
  const supabase = await createClient()

  // Get product IDs from the SO lines
  const { data: soLines } = await supabase
    .from('sales_order_lines')
    .select('product_id')
    .eq('sales_order_id', soId)
    .not('product_id', 'is', null)

  const productIds = [...new Set((soLines || []).map(l => l.product_id).filter(Boolean))]
  if (productIds.length === 0) return []

  const { data } = await supabase
    .from('product_suppliers')
    .select('product_id, supplier_id, is_preferred')
    .eq('org_id', user.orgId)
    .in('product_id', productIds as string[])

  return data || []
}

// --- List ---

export async function getSalesOrders() {
  const user = await requirePermission('sales_orders', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sales_orders')
    .select(`
      *,
      customers(id, name),
      users!sales_orders_assigned_to_fkey(id, first_name, last_name, initials, color),
      sales_order_lines(id, status, quantity, buy_price, sell_price, quantity_invoiced)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getSalesOrders]', error.message)
    return []
  }

  // Fetch jobs linked to sales orders via junction table + legacy source_type
  const soIds = (data || []).map(so => so.id)
  const linkedJobsBySo: Record<string, { id: string; job_number: string; status: string }> = {}

  if (soIds.length > 0) {
    // Junction table links
    const { data: jsoRows } = await supabase
      .from('job_sales_orders')
      .select('sales_order_id, jobs(id, job_number, status)')
      .eq('org_id', user.orgId)
      .in('sales_order_id', soIds)

    if (jsoRows) {
      for (const row of jsoRows) {
        const job = row.jobs as unknown as { id: string; job_number: string; status: string } | null
        if (job && !linkedJobsBySo[row.sales_order_id]) {
          linkedJobsBySo[row.sales_order_id] = { id: job.id, job_number: job.job_number, status: job.status }
        }
      }
    }

    // Legacy source_type links (jobs created before junction table)
    const { data: legacyJobs } = await supabase
      .from('jobs')
      .select('id, job_number, status, source_id')
      .eq('org_id', user.orgId)
      .eq('source_type', 'sales_order')
      .in('source_id', soIds)

    if (legacyJobs) {
      for (const j of legacyJobs) {
        if (!linkedJobsBySo[j.source_id]) {
          linkedJobsBySo[j.source_id] = { id: j.id, job_number: j.job_number, status: j.status }
        }
      }
    }
  }

  return (data || []).map(so => ({
    ...so,
    linked_job: linkedJobsBySo[so.id] || null,
  }))
}

// --- Detail ---

export async function getSalesOrder(id: string) {
  await requirePermission('sales_orders', 'view')
  const supabase = await createClient()

  const { data: so, error } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !so) return null

  const [
    { data: customer },
    { data: contact },
    { data: assignedUser },
    { data: lines, error: linesErr },
    { data: activities },
  ] = await Promise.all([
    supabase.from('customers').select('id, name, address_line1, address_line2, city, county, postcode').eq('id', so.customer_id).single().then(r => ({ ...r, data: r.data ? decryptCustomerRow(r.data) : null })),
    so.contact_id
      ? supabase.from('contacts').select('id, first_name, last_name, email, phone').eq('id', so.contact_id).single().then(r => ({ ...r, data: r.data ? decryptContactRow(r.data) : null }))
      : Promise.resolve({ data: null }),
    so.assigned_to
      ? supabase.from('users').select('id, first_name, last_name, initials, color').eq('id', so.assigned_to).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('sales_order_lines')
      .select('*, products(id, name, sku, is_stocked, is_serialised, product_type, product_categories(requires_serial)), suppliers(id, name)')
      .eq('sales_order_id', id)
      .order('group_sort', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('activity_log')
      .select('*, users:user_id(first_name, last_name, initials, color)')
      .eq('entity_type', 'sales_order')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (linesErr) {
    console.error('[getSalesOrder] Failed to fetch SO lines:', linesErr.message, linesErr.details, linesErr.hint)
  }

  return {
    ...so,
    customer,
    contact,
    assignedUser,
    lines: lines || [],
    activities: activities || [],
  }
}

// --- Create ---

interface CreateSalesOrderInput {
  quoteId: string
  customerPo: string
  assignedTo: string | null
  requestedDeliveryDate: string | null
  requiresInstall: boolean
  requestedInstallDate: string | null
  installNotes: string | null
  notes: string | null
  lineOverrides: Record<string, { fulfilment_route: string; delivery_destination: string }>
  deliveryAddress?: {
    line1: string | null
    line2: string | null
    city: string | null
    postcode: string | null
  }
}

export async function createSalesOrder(input: CreateSalesOrderInput) {
  const user = await requirePermission('sales_orders', 'create')
  const supabase = await createClient()

  // Guard: check no existing SO for this quote
  const { data: existingSo } = await supabase
    .from('sales_orders')
    .select('id')
    .eq('quote_id', input.quoteId)
    .maybeSingle()

  if (existingSo) {
    return { error: 'A Sales Order already exists for this quote.' }
  }

  // Fetch quote
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', input.quoteId)
    .single()

  if (quoteErr || !quote) {
    return { error: 'Quote not found.' }
  }

  // Fetch quote groups and lines (with product data for service detection)
  const [{ data: groups, error: groupsErr }, { data: quoteLines, error: quoteLinesErr }] = await Promise.all([
    supabase.from('quote_groups').select('*').eq('quote_id', input.quoteId).order('sort_order'),
    supabase.from('quote_lines').select('*, products(id, product_type, is_stocked, is_serialised)').eq('quote_id', input.quoteId).order('sort_order'),
  ])

  if (quoteLinesErr) {
    console.error('[createSalesOrder] Failed to fetch quote lines:', quoteLinesErr.message)
    return { error: `Failed to fetch quote lines: ${quoteLinesErr.message}` }
  }

  if (groupsErr) {
    console.error('[createSalesOrder] Failed to fetch quote groups:', groupsErr.message)
  }

  if (!quoteLines || quoteLines.length === 0) {
    return { error: 'Quote has no line items.' }
  }

  // Fetch customer for delivery address
  const { data: rawCustomer } = await supabase
    .from('customers')
    .select('address_line1, address_line2, city, postcode')
    .eq('id', quote.customer_id)
    .single()
  const customer = rawCustomer ? decryptCustomerRow(rawCustomer) : null

  // Generate SO number
  const soNumber = await generateSoNumber(supabase, user.orgId)

  // Build group lookup: group_id → group_name, group_sort
  const groupMap = new Map<string, { name: string; sort_order: number }>()
  if (groups) {
    for (const g of groups) {
      groupMap.set(g.id, { name: g.name, sort_order: g.sort_order })
    }
  }

  // Insert sales order
  const { data: newSo, error: soErr } = await supabase
    .from('sales_orders')
    .insert({
      org_id: user.orgId,
      quote_id: input.quoteId,
      customer_id: quote.customer_id,
      contact_id: quote.contact_id,
      so_number: soNumber,
      status: 'pending',
      customer_po: input.customerPo,
      delivery_address_line1: input.deliveryAddress?.line1 ?? customer?.address_line1 ?? null,
      delivery_address_line2: input.deliveryAddress?.line2 ?? customer?.address_line2 ?? null,
      delivery_city: input.deliveryAddress?.city ?? customer?.city ?? null,
      delivery_postcode: input.deliveryAddress?.postcode ?? customer?.postcode ?? null,
      vat_rate: quote.vat_rate,
      notes: input.notes,
      quote_number: quote.quote_number,
      assigned_to: input.assignedTo,
      accepted_at: quote.accepted_at,
      requested_delivery_date: input.requestedDeliveryDate || null,
      requires_install: input.requiresInstall,
      requested_install_date: input.requestedInstallDate || null,
      install_notes: input.installNotes || null,
    })
    .select('id')
    .single()

  if (soErr || !newSo) {
    console.error('[createSalesOrder]', soErr?.message)
    return { error: soErr?.message || 'Failed to create sales order.' }
  }

  // Insert SO lines (copy from quote lines, skip optional lines)
  const soLines = quoteLines
    .filter((ql) => !ql.is_optional)
    .map((ql) => {
      const override = input.lineOverrides[ql.id] || {}
      const group = ql.group_id ? groupMap.get(ql.group_id) : null
      const service = isServiceItem(ql.products)
      return {
        sales_order_id: newSo.id,
        quote_line_id: ql.id,
        product_id: ql.product_id,
        supplier_id: ql.supplier_id,
        deal_reg_line_id: ql.deal_reg_line_id,
        sort_order: ql.sort_order,
        description: ql.description,
        quantity: ql.quantity,
        buy_price: ql.buy_price,
        sell_price: ql.sell_price,
        fulfilment_route: override.fulfilment_route || ql.fulfilment_route,
        requires_contract: ql.requires_contract || false,
        status: 'pending',
        delivery_destination: service ? null : (override.delivery_destination || ((override.fulfilment_route || ql.fulfilment_route) === 'drop_ship' ? 'customer_site' : 'psd_office')),
        group_name: group?.name || null,
        group_sort: group?.sort_order ?? 0,
        is_service: service,
        quantity_received: 0,
        serial_numbers_received: [],
      }
    })

  if (soLines.length > 0) {
    const { error: linesErr } = await supabase
      .from('sales_order_lines')
      .insert(soLines)

    if (linesErr) {
      console.error('[createSalesOrder] lines insert failed:', linesErr.message, linesErr.details, linesErr.hint)
      // Clean up the SO if lines fail
      const { error: cleanupErr } = await supabase.from('sales_orders').delete().eq('id', newSo.id)
      if (cleanupErr) {
        console.error('[createSalesOrder] cleanup delete also failed:', cleanupErr.message)
      }
      return { error: `Failed to create sales order lines: ${linesErr.message}` }
    }
  } else {
    console.error('[createSalesOrder] No non-optional lines found. Quote lines:', quoteLines.length, 'Optional:', quoteLines.filter(ql => ql.is_optional).length)
    // Clean up the SO — no lines to insert
    await supabase.from('sales_orders').delete().eq('id', newSo.id)
    return { error: 'All quote lines are optional — no lines to transfer to sales order.' }
  }

  // Update quote status to accepted (belt & braces)
  await supabase
    .from('quotes')
    .update({ status: 'accepted' })
    .eq('id', input.quoteId)

  // Update opportunity to won
  if (quote.opportunity_id) {
    await supabase
      .from('opportunities')
      .update({ stage: 'won' })
      .eq('id', quote.opportunity_id)
  }

  // Activity log
  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: newSo.id,
    action: 'created',
    details: {
      so_number: soNumber,
      quote_number: quote.quote_number,
      customer_po: input.customerPo,
      line_count: soLines.length,
    },
  })

  revalidatePath('/orders')
  revalidatePath('/quotes')
  revalidatePath(`/quotes/${input.quoteId}`)

  return { data: { id: newSo.id } }
}

// --- Update line status ---

export async function updateLineStatus(soId: string, lineId: string, newStatus: string) {
  const user = await requireSoOperationPermission()
  const supabase = await createClient()

  // Fetch current line
  const { data: line, error: lineErr } = await supabase
    .from('sales_order_lines')
    .select('id, status, fulfilment_route, description, is_service, delivery_destination')
    .eq('id', lineId)
    .eq('sales_order_id', soId)
    .single()

  if (lineErr || !line) {
    return { error: 'Line not found.' }
  }

  // Validate transition
  const validTransitions = getValidTransitions(line.fulfilment_route, line.status, line.is_service, line.delivery_destination)
  if (!validTransitions.includes(newStatus)) {
    return { error: `Cannot transition from ${line.status} to ${newStatus} for ${line.fulfilment_route} lines.` }
  }

  const { error: updateErr } = await supabase
    .from('sales_order_lines')
    .update({ status: newStatus })
    .eq('id', lineId)

  if (updateErr) {
    return { error: updateErr.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: soId,
    action: 'line_status_changed',
    details: {
      line_id: lineId,
      description: line.description,
      from_status: line.status,
      to_status: newStatus,
    },
  })

  revalidatePath(`/orders/${soId}`)
  revalidatePath('/orders')

  return { success: true }
}

// --- Receive goods ---

interface ReceiveGoodsInput {
  soId: string
  lineId: string
  quantityReceived: number
  serialNumbers: string[]
}

export async function receiveGoods(input: ReceiveGoodsInput) {
  const user = await requireSoOperationPermission()
  const supabase = await createClient()

  // Fetch current line
  const { data: line, error: lineErr } = await supabase
    .from('sales_order_lines')
    .select('id, status, fulfilment_route, description, quantity, quantity_received, serial_numbers_received, is_service, products(id, is_serialised)')
    .eq('id', input.lineId)
    .eq('sales_order_id', input.soId)
    .single()

  if (lineErr || !line) {
    return { error: 'Line not found.' }
  }

  // Only drop_ship lines in ordered/partial_received can receive goods
  if (line.is_service) {
    return { error: 'Service items cannot receive goods.' }
  }
  if (!['ordered', 'partial_received'].includes(line.status)) {
    return { error: `Cannot receive goods for a line with status "${line.status}".` }
  }

  // Validate quantity
  const totalAfter = line.quantity_received + input.quantityReceived
  if (input.quantityReceived <= 0) {
    return { error: 'Quantity received must be greater than zero.' }
  }
  if (totalAfter > line.quantity) {
    return { error: `Cannot receive ${input.quantityReceived} — only ${line.quantity - line.quantity_received} remaining.` }
  }

  // Validate serial numbers if product requires them
  const product = (line.products ?? null) as unknown as { id: string; is_serialised: boolean | null } | null
  const requiresSerials = product?.is_serialised === true
  if (requiresSerials && input.serialNumbers.length !== input.quantityReceived) {
    return { error: `Expected ${input.quantityReceived} serial number(s) but received ${input.serialNumbers.length}.` }
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
  }

  // Check serial uniqueness against registry
  if (input.serialNumbers.length > 0 && requiresSerials) {
    const { data: existing } = await supabase
      .from('serial_number_registry')
      .select('serial_number')
      .eq('org_id', user.orgId)
      .eq('product_id', product!.id)
      .in('serial_number', input.serialNumbers)

    if (existing && existing.length > 0) {
      const dupes = existing.map(e => e.serial_number).join(', ')
      return { error: `Duplicate serial number(s) already in system: ${dupes}` }
    }
  }

  // Determine new status
  const newStatus = totalAfter >= line.quantity ? 'received' : 'partial_received'

  // Merge serial numbers
  const allSerials = [...(line.serial_numbers_received || []), ...input.serialNumbers]

  const { error: updateErr } = await supabase
    .from('sales_order_lines')
    .update({
      quantity_received: totalAfter,
      serial_numbers_received: allSerials,
      status: newStatus,
    })
    .eq('id', input.lineId)

  if (updateErr) {
    return { error: updateErr.message }
  }

  // Register serial numbers for goods received directly on SO (e.g. drop-ship to PSD office)
  if (input.serialNumbers.length > 0 && requiresSerials && product) {
    // Find default stock location for registry entries
    const { data: defaultLocation } = await supabase
      .from('stock_locations')
      .select('id')
      .eq('org_id', user.orgId)
      .eq('is_default', true)
      .limit(1)
      .single()

    if (defaultLocation) {
      const registryRows = input.serialNumbers.map(sn => ({
        org_id: user.orgId,
        product_id: product.id,
        serial_number: sn,
        status: 'in_stock' as const,
        location_id: defaultLocation.id,
        received_at: new Date().toISOString(),
      }))
      const { error: regErr } = await supabase
        .from('serial_number_registry')
        .insert(registryRows)
      if (regErr) {
        console.error('[receiveGoods] serial registry insert', regErr.message)
      }
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: input.soId,
    action: 'goods_received',
    details: {
      line_id: input.lineId,
      description: line.description,
      quantity_received: input.quantityReceived,
      total_received: totalAfter,
      total_ordered: line.quantity,
      serial_numbers: input.serialNumbers.length > 0 ? input.serialNumbers : undefined,
      new_status: newStatus,
    },
  })

  revalidatePath(`/orders/${input.soId}`)
  revalidatePath('/orders')

  return { success: true, newStatus }
}

// --- Update supplier on SO line ---

export async function updateSoLineSupplier(soId: string, lineId: string, supplierId: string) {
  const user = await requireSoOperationPermission()
  const supabase = await createClient()

  // Fetch current line
  const { data: line, error: lineErr } = await supabase
    .from('sales_order_lines')
    .select('id, status, description, supplier_id, suppliers(name)')
    .eq('id', lineId)
    .eq('sales_order_id', soId)
    .single()

  if (lineErr || !line) {
    return { error: 'Line not found.' }
  }

  if (line.status !== 'pending') {
    return { error: 'Supplier can only be changed on pending lines.' }
  }

  // Get new supplier name for logging
  const { data: newSupplier } = await supabase
    .from('suppliers')
    .select('name')
    .eq('id', supplierId)
    .single()

  const { error: updateErr } = await supabase
    .from('sales_order_lines')
    .update({ supplier_id: supplierId })
    .eq('id', lineId)

  if (updateErr) {
    return { error: updateErr.message }
  }

  const oldSupplierName = (line.suppliers as unknown as { name: string } | null)?.name || 'None'

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: soId,
    action: 'so.supplier_changed',
    details: {
      line_id: lineId,
      product_name: line.description,
      from_supplier: oldSupplierName,
      to_supplier: newSupplier?.name || 'Unknown',
      changed_by: `${user.firstName} ${user.lastName}`,
    },
  })

  revalidatePath(`/orders/${soId}`)
  return { success: true }
}

// --- Bulk update SO lines before PO generation ---

export async function updateSoLinesForPo(
  soId: string,
  updates: { lineId: string; supplierId: string; deliveryDestination: string }[]
) {
  const user = await requirePermission('purchase_orders', 'create')
  const supabase = await createClient()

  for (const { lineId, supplierId, deliveryDestination } of updates) {
    const { data: line, error: lineErr } = await supabase
      .from('sales_order_lines')
      .select('id, status, supplier_id, delivery_destination')
      .eq('id', lineId)
      .eq('sales_order_id', soId)
      .single()

    if (lineErr || !line) continue

    if (line.status !== 'pending') {
      return { error: 'All lines must be in pending status to update for PO generation.' }
    }

    const changes: Record<string, string> = {}
    if (supplierId && supplierId !== line.supplier_id) {
      changes.supplier_id = supplierId
    }
    if (deliveryDestination && deliveryDestination !== line.delivery_destination) {
      changes.delivery_destination = deliveryDestination
    }

    if (Object.keys(changes).length > 0) {
      const { error: updateErr } = await supabase
        .from('sales_order_lines')
        .update(changes)
        .eq('id', lineId)

      if (updateErr) {
        return { error: `Failed to update line: ${updateErr.message}` }
      }
    }
  }

  revalidatePath(`/orders/${soId}`)
  return { success: true }
}

// --- Cancel order ---

export async function cancelOrder(soId: string) {
  const user = await requireSoOperationPermission()
  const supabase = await createClient()

  // Cancel all non-terminal lines
  const { error } = await supabase
    .from('sales_order_lines')
    .update({ status: 'cancelled' })
    .eq('sales_order_id', soId)
    .not('status', 'in', '("delivered","cancelled")')

  if (error) {
    return { error: error.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: soId,
    action: 'cancelled',
  })

  revalidatePath(`/orders/${soId}`)
  revalidatePath('/orders')

  return { success: true }
}

// --- Update Customer PO ---

export async function updateSoCustomerPo(soId: string, customerPo: string) {
  const user = await requireSoOperationPermission()
  const supabase = await createClient()

  const { error } = await supabase
    .from('sales_orders')
    .update({ customer_po: customerPo })
    .eq('id', soId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: soId,
    action: 'customer_po_updated',
    details: { customer_po: customerPo },
  })

  revalidatePath(`/orders/${soId}`)
  return { success: true }
}

export async function toggleRequiresInstall(soId: string, requiresInstall: boolean) {
  const user = await requireSoOperationPermission()
  const supabase = await createClient()

  const { error } = await supabase
    .from('sales_orders')
    .update({ requires_install: requiresInstall })
    .eq('id', soId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: soId,
    action: requiresInstall ? 'install_required' : 'install_removed',
    details: { requires_install: requiresInstall },
  })

  revalidatePath(`/orders/${soId}`)
  revalidatePath('/orders')
  return { success: true }
}

export async function getLinkedJobsForSo(soId: string) {
  const user = await requirePermission('sales_orders', 'view')
  const supabase = await createClient()

  // Check junction table (primary source)
  const { data: jsoRows } = await supabase
    .from('job_sales_orders')
    .select('job_id, jobs(id, job_number, status, assigned_to, scheduled_date)')
    .eq('sales_order_id', soId)
    .eq('org_id', user.orgId)

  const jobs = (jsoRows || [])
    .map(row => row.jobs as unknown as { id: string; job_number: string; status: string; assigned_to: string | null; scheduled_date: string | null } | null)
    .filter(Boolean) as { id: string; job_number: string; status: string; assigned_to: string | null; scheduled_date: string | null }[]

  // Also check legacy source_type link (jobs created before junction table)
  const { data: legacyJob } = await supabase
    .from('jobs')
    .select('id, job_number, status, assigned_to, scheduled_date')
    .eq('org_id', user.orgId)
    .eq('source_type', 'sales_order')
    .eq('source_id', soId)
    .limit(1)
    .maybeSingle()

  if (legacyJob && !jobs.some(j => j.id === legacyJob.id)) {
    jobs.push(legacyJob)
  }

  return jobs
}

// --- Link to next site visit ---

export async function linkSoToNextJob(soId: string): Promise<{ success: boolean; error?: string; job?: { id: string; job_number: string; status: string; scheduled_date: string | null } }> {
  const user = await requireSoOperationPermission()
  const supabase = await createClient()

  // Get the SO to find the customer
  const { data: so } = await supabase
    .from('sales_orders')
    .select('id, customer_id, so_number')
    .eq('id', soId)
    .single()

  if (!so) return { success: false, error: 'Sales order not found' }

  // Find the next scheduled job for this customer (today or future)
  const today = new Date().toISOString().split('T')[0]
  const { data: nextJob } = await supabase
    .from('jobs')
    .select('id, job_number, status, scheduled_date, company_id')
    .eq('company_id', so.customer_id)
    .eq('org_id', user.orgId)
    .in('status', ['unscheduled', 'scheduled'])
    .or(`scheduled_date.gte.${today},scheduled_date.is.null`)
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!nextJob) {
    return { success: false, error: 'No upcoming jobs found for this customer. Please book a job first.' }
  }

  // Check if already linked
  const { data: existing } = await supabase
    .from('job_sales_orders')
    .select('id')
    .eq('job_id', nextJob.id)
    .eq('sales_order_id', soId)
    .maybeSingle()

  if (existing) {
    return { success: false, error: `This SO is already linked to ${nextJob.job_number}.` }
  }

  // Link via junction table
  const { error } = await supabase
    .from('job_sales_orders')
    .insert({ job_id: nextJob.id, sales_order_id: soId, org_id: user.orgId })

  if (error) return { success: false, error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: soId,
    action: 'linked_to_job',
    details: {
      job_id: nextJob.id,
      job_number: nextJob.job_number,
      so_number: so.so_number,
    },
  })

  revalidatePath(`/orders/${soId}`)

  return {
    success: true,
    job: {
      id: nextJob.id,
      job_number: nextJob.job_number,
      status: nextJob.status,
      scheduled_date: nextJob.scheduled_date,
    },
  }
}

export async function unlinkSoFromJob(soId: string, jobId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireSoOperationPermission()
  const supabase = await createClient()

  const { error } = await supabase
    .from('job_sales_orders')
    .delete()
    .eq('job_id', jobId)
    .eq('sales_order_id', soId)

  if (error) return { success: false, error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: soId,
    action: 'unlinked_from_job',
    details: { job_id: jobId },
  })

  revalidatePath(`/orders/${soId}`)
  return { success: true }
}

// --- Seed data ---

export async function seedSalesOrders() {
  const user = await requirePermission('sales_orders', 'create')
  const supabase = await createClient()

  // Check if any SOs already exist
  const { data: existingSos } = await supabase
    .from('sales_orders')
    .select('id')
    .eq('org_id', user.orgId)
    .limit(1)

  if (existingSos && existingSos.length > 0) {
    return { error: 'Sales orders already exist. Seed data is idempotent — skipping.' }
  }

  // Find first accepted quote
  const { data: acceptedQuotes } = await supabase
    .from('quotes')
    .select('id, quote_number, customer_id, contact_id, opportunity_id, vat_rate, accepted_at, assigned_to')
    .eq('org_id', user.orgId)
    .eq('status', 'accepted')
    .order('created_at')
    .limit(1)

  let quote = acceptedQuotes?.[0] ?? null

  if (!quote) {
    // Try any sent/draft quote instead
    const { data: anyQuotes } = await supabase
      .from('quotes')
      .select('id, quote_number, customer_id, contact_id, opportunity_id, vat_rate, accepted_at, assigned_to')
      .eq('org_id', user.orgId)
      .in('status', ['sent', 'draft'])
      .order('created_at')
      .limit(1)

    if (!anyQuotes || anyQuotes.length === 0) {
      return { error: 'No quotes found to create seed sales orders from. Please seed quotes first.' }
    }

    // Update this quote to accepted
    await supabase
      .from('quotes')
      .update({
        status: 'accepted',
        customer_po: 'PO-SEED-001',
        accepted_at: new Date().toISOString(),
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
      })
      .eq('id', anyQuotes[0].id)

    quote = { ...anyQuotes[0], accepted_at: new Date().toISOString() }
  }

  // Fetch quote lines and groups (with product data for service detection)
  const [{ data: groups }, { data: quoteLines }] = await Promise.all([
    supabase.from('quote_groups').select('*').eq('quote_id', quote.id).order('sort_order'),
    supabase.from('quote_lines').select('*, products(id, product_type, is_stocked, is_serialised)').eq('quote_id', quote.id).order('sort_order'),
  ])

  if (!quoteLines || quoteLines.length === 0) {
    return { error: 'Quote has no lines. Cannot seed SO.' }
  }

  // Fetch customer for address
  const { data: rawCustomerSeed } = await supabase
    .from('customers')
    .select('address_line1, address_line2, city, postcode')
    .eq('id', quote.customer_id)
    .single()
  const customer = rawCustomerSeed ? decryptCustomerRow(rawCustomerSeed) : null

  const soNumber = await generateSoNumber(supabase, user.orgId)

  // Build group map
  const groupMap = new Map<string, { name: string; sort_order: number }>()
  if (groups) {
    for (const g of groups) {
      groupMap.set(g.id, { name: g.name, sort_order: g.sort_order })
    }
  }

  // Create SO
  const { data: newSo, error: soErr } = await supabase
    .from('sales_orders')
    .insert({
      org_id: user.orgId,
      quote_id: quote.id,
      customer_id: quote.customer_id,
      contact_id: quote.contact_id,
      so_number: soNumber,
      status: 'pending',
      customer_po: 'PO-SEED-001',
      delivery_address_line1: customer?.address_line1 || null,
      delivery_address_line2: customer?.address_line2 || null,
      delivery_city: customer?.city || null,
      delivery_postcode: customer?.postcode || null,
      vat_rate: quote.vat_rate,
      quote_number: quote.quote_number,
      assigned_to: quote.assigned_to || user.id,
      accepted_at: quote.accepted_at,
      requested_delivery_date: '2026-03-15',
      requires_install: true,
      requested_install_date: '2026-03-20',
      install_notes: 'Install in server room B, contact IT manager on arrival',
    })
    .select('id')
    .single()

  if (soErr || !newSo) {
    console.error('[seedSalesOrders]', soErr?.message)
    return { error: soErr?.message || 'Failed to create seed SO.' }
  }

  // Create lines with mixed statuses for demo
  const nonOptionalLines = quoteLines.filter((ql) => !ql.is_optional)

  const soLines = nonOptionalLines.map((ql, i) => {
    const group = ql.group_id ? groupMap.get(ql.group_id) : null
    const service = isServiceItem(ql.products)

    // Service items: simplified path
    if (service) {
      return {
        sales_order_id: newSo.id,
        quote_line_id: ql.id,
        product_id: ql.product_id,
        supplier_id: ql.supplier_id,
        deal_reg_line_id: ql.deal_reg_line_id,
        sort_order: ql.sort_order,
        description: ql.description,
        quantity: ql.quantity,
        buy_price: ql.buy_price,
        sell_price: ql.sell_price,
        fulfilment_route: ql.fulfilment_route || 'drop_ship',
        requires_contract: ql.requires_contract || false,
        status: i % 2 === 0 ? 'pending' : 'delivered',
        delivery_destination: null,
        group_name: group?.name || null,
        group_sort: group?.sort_order ?? 0,
        is_service: true,
        quantity_received: 0,
        serial_numbers_received: [],
      }
    }

    const route = i % 2 === 0 ? 'from_stock' : 'drop_ship'
    // Assign a valid status for the route
    let status: string
    let qtyReceived = 0
    if (route === 'from_stock') {
      const stockStatuses = ['pending', 'picked', 'delivered']
      status = stockStatuses[i % stockStatuses.length]
    } else {
      const dropShipStatuses = ['pending', 'ordered', 'partial_received', 'received', 'delivered']
      status = dropShipStatuses[i % dropShipStatuses.length]
      // Simulate partial receive
      if (status === 'partial_received') {
        qtyReceived = Math.max(1, Math.floor(ql.quantity / 2))
      } else if (status === 'received' || status === 'delivered') {
        qtyReceived = ql.quantity
      }
    }
    return {
      sales_order_id: newSo.id,
      quote_line_id: ql.id,
      product_id: ql.product_id,
      supplier_id: ql.supplier_id,
      deal_reg_line_id: ql.deal_reg_line_id,
      sort_order: ql.sort_order,
      description: ql.description,
      quantity: ql.quantity,
      buy_price: ql.buy_price,
      sell_price: ql.sell_price,
      fulfilment_route: route,
      requires_contract: ql.requires_contract || false,
      status,
      delivery_destination: i % 3 === 0 ? 'psd_office' : 'customer_site',
      group_name: group?.name || null,
      group_sort: group?.sort_order ?? 0,
      is_service: false,
      quantity_received: qtyReceived,
      serial_numbers_received: [],
    }
  })

  if (soLines.length > 0) {
    const { error: linesErr } = await supabase
      .from('sales_order_lines')
      .insert(soLines)

    if (linesErr) {
      console.error('[seedSalesOrders] lines', linesErr.message)
      await supabase.from('sales_orders').delete().eq('id', newSo.id)
      return { error: 'Failed to create seed SO lines.' }
    }
  }

  // Update opportunity to won if linked
  if (quote.opportunity_id) {
    await supabase
      .from('opportunities')
      .update({ stage: 'won' })
      .eq('id', quote.opportunity_id)
  }

  logActivity({
    supabase,
    user,
    entityType: 'sales_order',
    entityId: newSo.id,
    action: 'created',
    details: {
      so_number: soNumber,
      quote_number: quote.quote_number,
      seeded: true,
    },
  })

  revalidatePath('/orders')
  revalidatePath('/quotes')

  return { success: true, soNumber }
}
