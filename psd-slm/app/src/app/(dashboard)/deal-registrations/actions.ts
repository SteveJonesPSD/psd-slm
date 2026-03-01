'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

// --- Types for line items passed from the form ---

interface LineInput {
  id?: string
  product_id: string
  registered_buy_price: number
  max_quantity: number | null
  notes: string | null
}

// --- Create ---

export async function createDealRegistration(formData: FormData, lines: LineInput[]) {
  const user = await requirePermission('deal_registrations', 'create')
  const supabase = await createClient()

  const title = (formData.get('title') as string)?.trim()
  const customer_id = formData.get('customer_id') as string
  const supplier_id = formData.get('supplier_id') as string

  if (!title) return { error: 'Title is required' }
  if (!customer_id) return { error: 'Customer is required' }
  if (!supplier_id) return { error: 'Supplier is required' }
  if (lines.length === 0) return { error: 'At least one product line is required' }

  const { data, error } = await supabase
    .from('deal_registrations')
    .insert({
      org_id: user.orgId,
      customer_id,
      supplier_id,
      title,
      reference: (formData.get('reference') as string) || null,
      status: (formData.get('status') as string) || 'active',
      registered_date: (formData.get('registered_date') as string) || null,
      expiry_date: (formData.get('expiry_date') as string) || null,
      notes: (formData.get('notes') as string) || null,
      registered_by: (formData.get('registered_by') as string) || user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Insert lines
  const lineRows = lines.map((l) => ({
    deal_reg_id: data.id,
    product_id: l.product_id,
    registered_buy_price: l.registered_buy_price,
    max_quantity: l.max_quantity,
    notes: l.notes,
  }))

  const { error: linesError } = await supabase
    .from('deal_registration_lines')
    .insert(lineRows)

  if (linesError) {
    // Roll back the header
    await supabase.from('deal_registrations').delete().eq('id', data.id)
    return { error: linesError.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'deal_registration',
    entityId: data.id,
    action: 'created',
    details: { title, customer_id, supplier_id, status: (formData.get('status') as string) || 'active' },
  })

  // Log individual line additions
  for (const line of lines) {
    logActivity({
      supabase,
      user,
      entityType: 'deal_registration_line',
      entityId: data.id,
      action: 'added',
      details: { product_id: line.product_id, registered_buy_price: line.registered_buy_price },
    })
  }

  revalidatePath('/deal-registrations')
  return { data }
}

// --- Update ---

export async function updateDealRegistration(id: string, formData: FormData, lines: LineInput[]) {
  const user = await requireAuth()
  const canEditAll = hasPermission(user, 'deal_registrations', 'edit_all')
  const canEditOwn = hasPermission(user, 'deal_registrations', 'edit_own')
  if (!canEditAll && !canEditOwn) throw new Error('Permission denied: deal_registrations.edit')
  const supabase = await createClient()

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'Title is required' }
  if (!formData.get('customer_id')) return { error: 'Customer is required' }
  if (!formData.get('supplier_id')) return { error: 'Supplier is required' }
  if (lines.length === 0) return { error: 'At least one product line is required' }

  const { error } = await supabase
    .from('deal_registrations')
    .update({
      customer_id: formData.get('customer_id') as string,
      supplier_id: formData.get('supplier_id') as string,
      title,
      reference: (formData.get('reference') as string) || null,
      status: (formData.get('status') as string) || 'active',
      registered_date: (formData.get('registered_date') as string) || null,
      expiry_date: (formData.get('expiry_date') as string) || null,
      notes: (formData.get('notes') as string) || null,
      registered_by: (formData.get('registered_by') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Fetch existing lines before replacing (for activity logging)
  const { data: existingLines } = await supabase
    .from('deal_registration_lines')
    .select('product_id')
    .eq('deal_reg_id', id)

  const oldProductIds = new Set((existingLines || []).map((l) => l.product_id))
  const newProductIds = new Set(lines.map((l) => l.product_id))

  // Delete existing lines and re-insert (simplest upsert strategy)
  await supabase.from('deal_registration_lines').delete().eq('deal_reg_id', id)

  const lineRows = lines.map((l) => ({
    deal_reg_id: id,
    product_id: l.product_id,
    registered_buy_price: l.registered_buy_price,
    max_quantity: l.max_quantity,
    notes: l.notes,
  }))

  const { error: linesError } = await supabase
    .from('deal_registration_lines')
    .insert(lineRows)

  if (linesError) return { error: linesError.message }

  logActivity({
    supabase,
    user,
    entityType: 'deal_registration',
    entityId: id,
    action: 'updated',
    details: { title, line_count: lines.length },
  })

  // Log removed lines
  for (const productId of oldProductIds) {
    if (!newProductIds.has(productId)) {
      logActivity({
        supabase,
        user,
        entityType: 'deal_registration_line',
        entityId: id,
        action: 'removed',
        details: { product_id: productId },
      })
    }
  }

  // Log added lines
  for (const line of lines) {
    if (!oldProductIds.has(line.product_id)) {
      logActivity({
        supabase,
        user,
        entityType: 'deal_registration_line',
        entityId: id,
        action: 'added',
        details: { product_id: line.product_id, registered_buy_price: line.registered_buy_price },
      })
    }
  }

  revalidatePath('/deal-registrations')
  revalidatePath(`/deal-registrations/${id}`)
  return { success: true }
}

// --- Change Status ---

export async function changeDealRegStatus(id: string, newStatus: string) {
  const user = await requireAuth()
  const canEditAll = hasPermission(user, 'deal_registrations', 'edit_all')
  const canEditOwn = hasPermission(user, 'deal_registrations', 'edit_own')
  if (!canEditAll && !canEditOwn) throw new Error('Permission denied: deal_registrations.edit')
  const supabase = await createClient()

  // Fetch current status for logging
  const { data: current } = await supabase
    .from('deal_registrations')
    .select('status, title')
    .eq('id', id)
    .single()

  if (!current) return { error: 'Deal registration not found' }

  const { error } = await supabase
    .from('deal_registrations')
    .update({ status: newStatus })
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'deal_registration',
    entityId: id,
    action: 'status_changed',
    details: { title: current.title, old_status: current.status, new_status: newStatus },
  })

  revalidatePath('/deal-registrations')
  revalidatePath(`/deal-registrations/${id}`)
  return { success: true }
}

// --- Duplicate ---

export async function duplicateDealRegistration(id: string) {
  const user = await requirePermission('deal_registrations', 'create')
  const supabase = await createClient()

  const { data: original } = await supabase
    .from('deal_registrations')
    .select('*, deal_registration_lines(*)')
    .eq('id', id)
    .single()

  if (!original) return { error: 'Deal registration not found' }

  const lines = original.deal_registration_lines as { product_id: string; registered_buy_price: number; max_quantity: number | null; notes: string | null }[]

  const { data: newReg, error } = await supabase
    .from('deal_registrations')
    .insert({
      org_id: user.orgId,
      customer_id: original.customer_id,
      supplier_id: original.supplier_id,
      title: `${original.title} (Copy)`,
      reference: null,
      status: 'pending',
      registered_date: new Date().toISOString().split('T')[0],
      expiry_date: null,
      notes: original.notes,
      registered_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  if (lines.length > 0) {
    const lineRows = lines.map((l) => ({
      deal_reg_id: newReg.id,
      product_id: l.product_id,
      registered_buy_price: l.registered_buy_price,
      max_quantity: l.max_quantity,
      notes: l.notes,
    }))

    await supabase.from('deal_registration_lines').insert(lineRows)
  }

  logActivity({
    supabase,
    user,
    entityType: 'deal_registration',
    entityId: newReg.id,
    action: 'created',
    details: { title: newReg.title, duplicated_from: id },
  })

  revalidatePath('/deal-registrations')
  return { data: newReg }
}

// --- Renew (duplicate with active status) ---

export async function renewDealRegistration(id: string) {
  const user = await requirePermission('deal_registrations', 'create')
  const supabase = await createClient()

  const { data: original } = await supabase
    .from('deal_registrations')
    .select('*, deal_registration_lines(*)')
    .eq('id', id)
    .single()

  if (!original) return { error: 'Deal registration not found' }

  const lines = original.deal_registration_lines as { product_id: string; registered_buy_price: number; max_quantity: number | null; notes: string | null }[]

  const { data: newReg, error } = await supabase
    .from('deal_registrations')
    .insert({
      org_id: user.orgId,
      customer_id: original.customer_id,
      supplier_id: original.supplier_id,
      title: original.title,
      reference: null,
      status: 'active',
      registered_date: new Date().toISOString().split('T')[0],
      expiry_date: null,
      notes: original.notes,
      registered_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  if (lines.length > 0) {
    const lineRows = lines.map((l) => ({
      deal_reg_id: newReg.id,
      product_id: l.product_id,
      registered_buy_price: l.registered_buy_price,
      max_quantity: l.max_quantity,
      notes: l.notes,
    }))

    await supabase.from('deal_registration_lines').insert(lineRows)
  }

  logActivity({
    supabase,
    user,
    entityType: 'deal_registration',
    entityId: newReg.id,
    action: 'created',
    details: { title: newReg.title, renewed_from: id },
  })

  revalidatePath('/deal-registrations')
  return { data: newReg }
}

// --- Delete ---

export async function deleteDealRegistration(id: string) {
  const user = await requirePermission('deal_registrations', 'delete')
  const supabase = await createClient()

  const { data: reg } = await supabase
    .from('deal_registrations')
    .select('title')
    .eq('id', id)
    .single()

  // Clean up attachment files from Storage (DB rows cascade-delete automatically)
  const { data: attachments } = await supabase
    .from('deal_registration_attachments')
    .select('storage_path')
    .eq('deal_reg_id', id)

  if (attachments && attachments.length > 0) {
    await supabase.storage
      .from('deal-reg-attachments')
      .remove(attachments.map((a) => a.storage_path))
  }

  const { error } = await supabase
    .from('deal_registrations')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'deal_registration',
    entityId: id,
    action: 'deleted',
    details: { title: reg?.title },
  })

  revalidatePath('/deal-registrations')
  return { success: true }
}

// --- Seed Data ---

export async function seedDealRegistrations() {
  const user = await requirePermission('deal_registrations', 'create')
  const supabase = await createClient()

  // Check if deal registrations already exist (idempotent)
  const { count } = await supabase
    .from('deal_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.orgId)

  if (count && count > 0) {
    return { error: 'Deal registrations already exist. Seed skipped to prevent duplicates.' }
  }

  // Fetch required lookups
  const [{ data: customers }, { data: suppliers }, { data: products }, { data: users }] = await Promise.all([
    supabase.from('customers').select('id, name').eq('org_id', user.orgId),
    supabase.from('suppliers').select('id, name').eq('org_id', user.orgId),
    supabase.from('products').select('id, sku, name, default_buy_price').eq('org_id', user.orgId),
    supabase.from('users').select('id, first_name, last_name').eq('org_id', user.orgId),
  ])

  const findCustomer = (name: string) => customers?.find((c) => c.name.includes(name))?.id
  const findSupplier = (name: string) => suppliers?.find((s) => s.name.includes(name))?.id
  const findProduct = (name: string) => products?.find((p) => p.name.includes(name))
  const findUser = (firstName: string) => users?.find((u) => u.first_name === firstName)?.id

  // Validate we have enough data to seed
  const meridian = findCustomer('Meridian')
  const northern = findCustomer('Northern')
  const hartwell = findCustomer('Hartwell')
  const pennine = findCustomer('Pennine')
  const ubiquiti = findSupplier('Ubiquiti')
  const sensirion = findSupplier('Sensirion')
  const excel = findSupplier('Excel')
  const mark = findUser('Mark')
  const rachel = findUser('Rachel')
  const jake = findUser('Jake')

  if (!ubiquiti || !sensirion || !excel) {
    return { error: 'Required suppliers not found. Please seed suppliers first.' }
  }

  if (!meridian && !northern && !hartwell && !pennine) {
    return { error: 'Required customers not found. Please seed customers first.' }
  }

  const seedRegs: {
    header: Record<string, unknown>
    lines: { product_name: string; catalogue: number; deal: number; max_qty: number | null }[]
  }[] = []

  // Deal Reg 1: Ubiquiti — Meridian Academy Trust
  if (meridian && ubiquiti) {
    seedRegs.push({
      header: {
        org_id: user.orgId,
        customer_id: meridian,
        supplier_id: ubiquiti,
        title: 'Ubiquiti Education Pricing \u2014 Meridian Academy',
        reference: 'UBI-2026-EDU-001',
        status: 'active',
        registered_date: '2026-01-15',
        expiry_date: '2026-07-15',
        registered_by: mark || user.id,
        notes: 'Education discount tier agreed with Ubiquiti regional manager.',
      },
      lines: [
        { product_name: '24-Port PoE', catalogue: 325, deal: 310, max_qty: 20 },
        { product_name: 'WiFi 6 Access Point', catalogue: 129, deal: 115, max_qty: 50 },
      ],
    })
  }

  // Deal Reg 2: Sensirion — Northern Health NHS
  if (northern && sensirion) {
    seedRegs.push({
      header: {
        org_id: user.orgId,
        customer_id: northern,
        supplier_id: sensirion,
        title: 'Sensirion NHS Framework Pricing',
        reference: 'SEN-NHS-2026-Q1',
        status: 'active',
        registered_date: '2026-02-01',
        expiry_date: '2027-01-31',
        registered_by: rachel || user.id,
        notes: 'NHS framework agreement — 12-month pricing lock.',
      },
      lines: [
        { product_name: 'SEN55', catalogue: 28.5, deal: 24, max_qty: 200 },
        { product_name: 'CO2 Sensor', catalogue: 42, deal: 38, max_qty: 100 },
      ],
    })
  }

  // Deal Reg 3: Excel — Hartwell (Expired)
  if (hartwell && excel) {
    seedRegs.push({
      header: {
        org_id: user.orgId,
        customer_id: hartwell,
        supplier_id: excel,
        title: 'Excel Cabling \u2014 Hartwell Properties',
        reference: 'EXC-HART-2025',
        status: 'expired',
        registered_date: '2025-06-01',
        expiry_date: '2025-12-31',
        registered_by: mark || user.id,
      },
      lines: [
        { product_name: 'Cat6A Cable', catalogue: 165, deal: 148, max_qty: 30 },
        { product_name: 'Cat6A Patch', catalogue: 2.8, deal: 2.4, max_qty: 500 },
      ],
    })
  }

  // Deal Reg 4: Ubiquiti — Pennine Leisure (Pending)
  if (pennine && ubiquiti) {
    seedRegs.push({
      header: {
        org_id: user.orgId,
        customer_id: pennine,
        supplier_id: ubiquiti,
        title: 'Ubiquiti Hospitality \u2014 Pennine Leisure',
        reference: 'UBI-PLG-2026',
        status: 'pending',
        registered_date: '2026-02-20',
        expiry_date: null,
        registered_by: jake || user.id,
      },
      lines: [
        { product_name: 'WiFi 6 Access Point', catalogue: 129, deal: 118, max_qty: 100 },
      ],
    })
  }

  let created = 0
  for (const reg of seedRegs) {
    const { data: newReg, error: regErr } = await supabase
      .from('deal_registrations')
      .insert(reg.header)
      .select()
      .single()

    if (regErr || !newReg) continue

    const lineRows = reg.lines
      .map((l) => {
        const product = findProduct(l.product_name)
        if (!product) return null
        return {
          deal_reg_id: newReg.id,
          product_id: product.id,
          registered_buy_price: l.deal,
          max_quantity: l.max_qty,
        }
      })
      .filter(Boolean)

    if (lineRows.length > 0) {
      await supabase.from('deal_registration_lines').insert(lineRows)
    }

    created++
  }

  revalidatePath('/deal-registrations')
  return { success: true, created }
}
