'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

export async function createProduct(formData: FormData) {
  const user = await requirePermission('products', 'create')
  const supabase = await createClient()

  const sku = (formData.get('sku') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()

  if (!sku) return { error: 'SKU is required' }
  if (!name) return { error: 'Product name is required' }

  // Check SKU uniqueness within org
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('org_id', user.orgId)
    .eq('sku', sku)
    .maybeSingle()

  if (existing) return { error: 'A product with this SKU already exists' }

  const buyStr = formData.get('default_buy_price') as string
  const sellStr = formData.get('default_sell_price') as string
  const serialisedStr = formData.get('is_serialised') as string

  const productType = (formData.get('product_type') as string) || 'goods'

  const defaultDelivery = (formData.get('default_delivery_destination') as string) || 'psd_office'

  const { data, error } = await supabase
    .from('products')
    .insert({
      org_id: user.orgId,
      sku,
      name,
      description: (formData.get('description') as string) || null,
      category_id: (formData.get('category_id') as string) || null,
      manufacturer: (formData.get('manufacturer') as string) || null,
      default_buy_price: buyStr ? parseFloat(buyStr) : null,
      default_sell_price: sellStr ? parseFloat(sellStr) : null,
      is_serialised: serialisedStr === 'null' ? null : serialisedStr === 'true',
      is_stocked: formData.get('is_stocked') === 'true',
      product_type: productType,
      default_delivery_destination: defaultDelivery,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Link main supplier if specified
  const mainSupplierId = formData.get('main_supplier_id') as string
  if (mainSupplierId) {
    const supplierSku = (formData.get('supplier_sku') as string) || null
    const supplierCostStr = formData.get('supplier_standard_cost') as string
    const supplierCost = supplierCostStr ? parseFloat(supplierCostStr) : null
    const isPreferred = formData.get('supplier_is_preferred') !== 'false'
    const supplierUrlStr = (formData.get('supplier_url') as string) || null

    const linkRow: Record<string, unknown> = {
      product_id: data.id,
      supplier_id: mainSupplierId,
      is_preferred: isPreferred,
      supplier_sku: supplierSku,
      standard_cost: supplierCostStr && !isNaN(Number(supplierCostStr)) ? supplierCost : null,
    }

    // Try with url column first, fall back without if column doesn't exist yet
    let linkResult = await supabase.from('product_suppliers').insert({ ...linkRow, url: supplierUrlStr })
    if (linkResult.error?.message?.includes('url')) {
      linkResult = await supabase.from('product_suppliers').insert(linkRow)
    }
    if (linkResult.error) {
      console.error('[createProduct] Failed to link supplier:', linkResult.error)
    }
  }

  // Activity log with optional source tracking
  const source = (formData.get('source') as string) || null
  const sourceUrl = (formData.get('source_url') as string) || null
  const activityDetails: Record<string, unknown> = { sku, name }
  if (source) activityDetails.source = source
  if (sourceUrl) activityDetails.source_url = sourceUrl

  logActivity({ supabase, user, entityType: 'product', entityId: data.id, action: 'created', details: activityDetails })
  revalidatePath('/products')
  return { data }
}

export async function updateProduct(id: string, formData: FormData) {
  const user = await requirePermission('products', 'edit_all')
  const supabase = await createClient()

  const sku = (formData.get('sku') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()

  if (!sku) return { error: 'SKU is required' }
  if (!name) return { error: 'Product name is required' }

  // Check SKU uniqueness (excluding self)
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('org_id', user.orgId)
    .eq('sku', sku)
    .neq('id', id)
    .maybeSingle()

  if (existing) return { error: 'A product with this SKU already exists' }

  const buyStr = formData.get('default_buy_price') as string
  const sellStr = formData.get('default_sell_price') as string
  const serialisedStr = formData.get('is_serialised') as string
  const isActiveStr = formData.get('is_active')

  const productType = (formData.get('product_type') as string) || 'goods'

  const defaultDelivery = (formData.get('default_delivery_destination') as string) || 'psd_office'

  const updates: Record<string, unknown> = {
    sku,
    name,
    description: (formData.get('description') as string) || null,
    category_id: (formData.get('category_id') as string) || null,
    manufacturer: (formData.get('manufacturer') as string) || null,
    default_buy_price: buyStr ? parseFloat(buyStr) : null,
    default_sell_price: sellStr ? parseFloat(sellStr) : null,
    is_serialised: serialisedStr === 'null' ? null : serialisedStr === 'true',
    is_stocked: formData.get('is_stocked') === 'true',
    product_type: productType,
    default_delivery_destination: defaultDelivery,
  }

  if (isActiveStr !== null) {
    updates.is_active = isActiveStr === 'true'
  }

  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)

  if (error) return { error: error.message }

  // Handle main supplier change
  const mainSupplierId = formData.get('main_supplier_id') as string
  if (mainSupplierId !== null) {
    // Get current preferred supplier
    const { data: currentPreferred } = await supabase
      .from('product_suppliers')
      .select('id, supplier_id')
      .eq('product_id', id)
      .eq('is_preferred', true)
      .maybeSingle()

    if (mainSupplierId && mainSupplierId !== currentPreferred?.supplier_id) {
      // Unset old preferred
      if (currentPreferred) {
        await supabase
          .from('product_suppliers')
          .update({ is_preferred: false })
          .eq('id', currentPreferred.id)
      }
      // Upsert new preferred — may already exist as a non-preferred link
      const { data: existingLink } = await supabase
        .from('product_suppliers')
        .select('id')
        .eq('product_id', id)
        .eq('supplier_id', mainSupplierId)
        .maybeSingle()

      if (existingLink) {
        await supabase
          .from('product_suppliers')
          .update({ is_preferred: true })
          .eq('id', existingLink.id)
      } else {
        await supabase
          .from('product_suppliers')
          .insert({ product_id: id, supplier_id: mainSupplierId, is_preferred: true })
      }
    } else if (!mainSupplierId && currentPreferred) {
      // Supplier cleared — unset preferred
      await supabase
        .from('product_suppliers')
        .update({ is_preferred: false })
        .eq('id', currentPreferred.id)
    }
  }

  logActivity({ supabase, user, entityType: 'product', entityId: id, action: 'updated', details: { sku, name } })
  revalidatePath('/products')
  revalidatePath(`/products/${id}`)
  return { success: true }
}

export async function checkSkuUnique(sku: string, excludeId?: string) {
  const user = await requirePermission('products', 'view')
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('id')
    .eq('org_id', user.orgId)
    .eq('sku', sku.trim())

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data } = await query.maybeSingle()
  return { exists: !!data }
}

export async function seedProducts() {
  const user = await requirePermission('products', 'create')
  const supabase = await createClient()

  // Get categories
  const { data: cats } = await supabase
    .from('product_categories')
    .select('id, name, sort_order')
    .eq('org_id', user.orgId)

  const catMap = Object.fromEntries((cats || []).map((c) => [c.name, c.id]))

  // Ensure "Professional Services" category exists for service products
  if (!catMap['Professional Services']) {
    const maxSort = (cats || []).reduce((max, c) => Math.max(max, (c as { sort_order?: number }).sort_order ?? 0), -1)
    const { data: newCat } = await supabase
      .from('product_categories')
      .insert({ org_id: user.orgId, name: 'Professional Services', requires_serial: false, sort_order: maxSort + 1 })
      .select('id')
      .single()
    if (newCat) catMap['Professional Services'] = newCat.id
  }

  const products: { sku: string; name: string; manufacturer: string | null; category: string; default_buy_price: number; default_sell_price: number | null; is_serialised: boolean; is_stocked: boolean; product_type: 'goods' | 'service' }[] = [
    { sku: 'ES-SENTRY-PRO', name: 'EnviroSentry Pro Unit', manufacturer: 'Innov8iv Labs', category: 'Environmental Sensors', default_buy_price: 145, default_sell_price: 285, is_serialised: true, is_stocked: true, product_type: 'goods' },
    { sku: 'ES-SENTRY-EDU', name: 'EnviroSentry SmartClass', manufacturer: 'Innov8iv Labs', category: 'Environmental Sensors', default_buy_price: 110, default_sell_price: 220, is_serialised: true, is_stocked: true, product_type: 'goods' },
    { sku: 'SEN-SEN55', name: 'Sensirion SEN55 Module', manufacturer: 'Sensirion', category: 'Environmental Sensors', default_buy_price: 28.5, default_sell_price: null, is_serialised: false, is_stocked: true, product_type: 'goods' },
    { sku: 'NET-SW24-POE', name: '24-Port PoE Managed Switch', manufacturer: 'Ubiquiti', category: 'Networking', default_buy_price: 325, default_sell_price: 445, is_serialised: true, is_stocked: false, product_type: 'goods' },
    { sku: 'NET-AP-AC', name: 'WiFi 6 Access Point', manufacturer: 'Ubiquiti', category: 'Networking', default_buy_price: 129, default_sell_price: 195, is_serialised: true, is_stocked: false, product_type: 'goods' },
    { sku: 'CAB-CAT6A-305', name: 'Cat6A Cable 305m Box', manufacturer: 'Excel', category: 'Cabling & Infrastructure', default_buy_price: 165, default_sell_price: 225, is_serialised: false, is_stocked: true, product_type: 'goods' },
    { sku: 'AC-READER-BLE', name: 'IngressaEdge BLE Reader', manufacturer: 'Innov8iv Labs', category: 'Access Control', default_buy_price: 85, default_sell_price: 165, is_serialised: true, is_stocked: true, product_type: 'goods' },
    { sku: 'SW-HA-PRO', name: 'Home Assistant Pro License', manufacturer: 'Nabu Casa', category: 'Software & Licensing', default_buy_price: 0, default_sell_price: 65, is_serialised: false, is_stocked: false, product_type: 'goods' },
    { sku: 'CAB-PATCH-1M', name: 'Cat6A Patch Lead 1m', manufacturer: 'Excel', category: 'Cabling & Infrastructure', default_buy_price: 2.8, default_sell_price: 5.5, is_serialised: false, is_stocked: true, product_type: 'goods' },
    { sku: 'ES-HEAD-CO2', name: 'EnviroSentry CO2 Sensor Head', manufacturer: 'Innov8iv Labs', category: 'Environmental Sensors', default_buy_price: 42, default_sell_price: 89, is_serialised: false, is_stocked: true, product_type: 'goods' },
    // Service products
    { sku: 'SVC-INSTALL-DAY', name: 'Installation Day (On-site)', manufacturer: null, category: 'Professional Services', default_buy_price: 200, default_sell_price: 450, is_serialised: false, is_stocked: false, product_type: 'service' },
    { sku: 'SVC-CONFIG-HR', name: 'Remote Configuration (per hour)', manufacturer: null, category: 'Professional Services', default_buy_price: 0, default_sell_price: 85, is_serialised: false, is_stocked: false, product_type: 'service' },
    { sku: 'SVC-PM-DAY', name: 'Project Management Day', manufacturer: null, category: 'Professional Services', default_buy_price: 0, default_sell_price: 400, is_serialised: false, is_stocked: false, product_type: 'service' },
    { sku: 'SVC-DELIVERY', name: 'Delivery & Handling', manufacturer: null, category: 'Professional Services', default_buy_price: 0, default_sell_price: 45, is_serialised: false, is_stocked: false, product_type: 'service' },
  ]

  const rows = products.map(({ category, ...p }) => ({
    ...p,
    org_id: user.orgId,
    category_id: catMap[category] || null,
  }))

  const { error } = await supabase.from('products').insert(rows)
  if (error) return { error: error.message }

  // Also seed product-supplier links
  await seedProductSupplierLinks(supabase, user.orgId)

  revalidatePath('/products')
  return { success: true }
}

export async function findSerial(serialNumber: string) {
  await requirePermission('stock', 'view')
  const supabase = await createClient()

  const trimmed = serialNumber.trim()
  if (!trimmed) return { data: [] }

  const { data: entries, error } = await supabase
    .from('serial_number_registry')
    .select(`
      *,
      products(id, name, sku),
      stock_locations(id, name),
      purchase_order_lines(id, purchase_orders(id, po_number)),
      delivery_notes(id, dn_number, dispatched_at)
    `)
    .ilike('serial_number', trimmed)

  if (error) return { error: error.message }
  if (!entries || entries.length === 0) return { data: [] }

  // For entries with an SO line, fetch SO + customer info and linked jobs
  const results = await Promise.all(
    entries.map(async (entry) => {
      let salesOrder: { id: string; so_number: string; order_date: string; customer_id: string; customers: { id: string; name: string } | null } | null = null
      let job: { id: string; job_number: string; status: string; scheduled_date: string | null; completed_at: string | null } | null = null

      if (entry.so_line_id) {
        const { data: soLine } = await supabase
          .from('sales_order_lines')
          .select('id, sales_orders!inner(id, so_number, order_date, customer_id, customers(id, name))')
          .eq('id', entry.so_line_id)
          .maybeSingle()

        if (soLine) {
          // Supabase !inner join may return array or object depending on types
          const so = Array.isArray(soLine.sales_orders)
            ? soLine.sales_orders[0]
            : soLine.sales_orders
          if (so) {
            const cust = Array.isArray(so.customers) ? so.customers[0] : so.customers
            salesOrder = { ...so, customers: cust || null }
          }
        }

        // Find linked job via source_type
        if (salesOrder) {
          const { data: linkedJob } = await supabase
            .from('jobs')
            .select('id, job_number, status, scheduled_date, completed_at')
            .eq('source_type', 'sales_order')
            .eq('source_id', salesOrder.id)
            .maybeSingle()
          if (linkedJob) job = linkedJob
        }
      }

      return {
        id: entry.id,
        serial_number: entry.serial_number,
        status: entry.status,
        product: entry.products as { id: string; name: string; sku: string } | null,
        location: entry.stock_locations as { id: string; name: string } | null,
        po_number: (entry.purchase_order_lines as { id: string; purchase_orders: { id: string; po_number: string } | null } | null)
          ?.purchase_orders?.po_number || null,
        sales_order: salesOrder ? {
          id: salesOrder.id,
          so_number: salesOrder.so_number,
          order_date: salesOrder.order_date,
        } : null,
        customer: salesOrder?.customers || null,
        job,
        delivery_note: entry.delivery_notes as { id: string; dn_number: string; dispatched_at: string | null } | null,
      }
    })
  )

  return { data: results }
}

async function seedProductSupplierLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
) {
  // Look up products by SKU
  const { data: products } = await supabase
    .from('products')
    .select('id, sku')
    .eq('org_id', orgId)

  // Look up suppliers by name
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('org_id', orgId)

  if (!products?.length || !suppliers?.length) return

  const prodMap = Object.fromEntries(products.map((p) => [p.sku, p.id]))
  const suppMap = Object.fromEntries(suppliers.map((s) => [s.name, s.id]))

  // Seed links: [product SKU, supplier name, supplier_sku, standard_cost, lead_time_days, is_preferred]
  const links: [string, string, string | null, number | null, number | null, boolean][] = [
    ['SEN-SEN55', 'Sensirion AG', 'SEN55-SDN-T', 28.50, 14, true],
    ['SEN-SEN55', 'RS Components', '123-4567', 31.20, 3, false],
    ['SEN-SEN55', 'Farnell', 'SEN55', 30.80, 5, false],
    ['NET-SW24-POE', 'Ubiquiti Networks', 'USW-24-POE', 325.00, 7, true],
    ['NET-AP-AC', 'Ubiquiti Networks', 'U6-PRO', 129.00, 7, true],
    ['CAB-CAT6A-305', 'Excel Networking', '100-076', 165.00, 3, true],
    ['CAB-CAT6A-305', 'RS Components', '456-7890', 172.00, 2, false],
    ['CAB-PATCH-1M', 'Excel Networking', '100-300', 2.80, 3, true],
    ['AC-READER-BLE', 'RS Components', '789-0123', 52.00, 5, false],
    ['ES-HEAD-CO2', 'Sensirion AG', 'SCD41-D-R2', 38.00, 14, true],
    ['SW-HA-PRO', 'Farnell', null, null, null, false],
  ]

  const rows = links
    .filter(([sku, supplier]) => prodMap[sku] && suppMap[supplier])
    .map(([sku, supplier, supplier_sku, standard_cost, lead_time_days, is_preferred]) => ({
      product_id: prodMap[sku],
      supplier_id: suppMap[supplier],
      supplier_sku,
      standard_cost,
      lead_time_days,
      is_preferred,
    }))

  if (rows.length > 0) {
    await supabase.from('product_suppliers').insert(rows)
  }
}
