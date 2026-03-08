'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireAuth, hasAnyPermission } from '@/lib/auth'
import { decryptCustomerRow, decryptContactRow, decryptContactRows } from '@/lib/crypto-helpers'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { generateInvoiceNumber, getEffectiveInvoiceStatus } from '@/lib/invoicing'

// --- List ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getInvoices(): Promise<any[]> {
  const user = await requirePermission('invoices', 'view')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customers:customer_id(id, name),
      contacts(id, first_name, last_name),
      brands(id, name, invoice_prefix),
      sales_orders!inner(id, so_number)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getInvoices]', error.message)
    return []
  }

  return (data || []).map((inv) => ({
    ...inv,
    effectiveStatus: getEffectiveInvoiceStatus(
      inv.status as 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | 'credit_note',
      inv.due_date as string | null,
    ),
  }))
}

// --- Detail ---

export async function getInvoice(id: string) {
  await requirePermission('invoices', 'view')
  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !invoice) return null

  const [
    { data: customer },
    { data: contact },
    { data: brand },
    { data: lines },
    { data: so },
    { data: quote },
    { data: attributions },
    { data: relatedInvoices },
    { data: activities },
    { data: parentInvoice },
  ] = await Promise.all([
    supabase.from('customers').select('id, name, address_line1, address_line2, city, postcode, payment_terms').eq('id', invoice.customer_id).single().then(r => ({ ...r, data: r.data ? decryptCustomerRow(r.data) : null })),
    invoice.contact_id
      ? supabase.from('contacts').select('id, first_name, last_name, email, phone').eq('id', invoice.contact_id).single().then(r => ({ ...r, data: r.data ? decryptContactRow(r.data) : null }))
      : Promise.resolve({ data: null }),
    invoice.brand_id
      ? supabase.from('brands').select('*').eq('id', invoice.brand_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('invoice_lines')
      .select('*, products(id, name, sku), sales_order_lines!invoice_lines_sales_order_line_id_fkey(serial_numbers_received)')
      .eq('invoice_id', id)
      .order('sort_order', { ascending: true }),
    supabase.from('sales_orders').select('id, so_number, quote_id, customer_po, delivery_address_line1, delivery_address_line2, delivery_city, delivery_postcode').eq('id', invoice.sales_order_id).single(),
    invoice.quote_id
      ? supabase.from('quotes').select('id, quote_number, opportunity_id').eq('id', invoice.quote_id).single()
      : Promise.resolve({ data: null }),
    invoice.quote_id
      ? supabase.from('quote_attributions').select('*, users(id, first_name, last_name, initials, color)').eq('quote_id', invoice.quote_id)
      : Promise.resolve({ data: null }),
    supabase.from('invoices').select('id, invoice_number, status, total, invoice_type, paid_at, created_at')
      .eq('sales_order_id', invoice.sales_order_id)
      .neq('id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('activity_log')
      .select('*, users:user_id(first_name, last_name, initials, color)')
      .eq('entity_type', 'invoice')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    invoice.parent_invoice_id
      ? supabase.from('invoices').select('id, invoice_number, status, total').eq('id', invoice.parent_invoice_id).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    ...invoice,
    effectiveStatus: getEffectiveInvoiceStatus(invoice.status, invoice.due_date),
    customer,
    contact,
    brand,
    lines: lines || [],
    salesOrder: so,
    quote,
    attributions: attributions || [],
    relatedInvoices: relatedInvoices || [],
    activities: activities || [],
    parentInvoice,
  }
}

// --- Get SO data for invoice creation ---

export async function getSalesOrderForInvoice(soId: string) {
  const user = await requirePermission('invoices', 'view')
  const supabase = await createClient()

  const { data: so, error: soError } = await supabase
    .from('sales_orders')
    .select(`
      *,
      customers(id, name, payment_terms),
      sales_order_lines(
        id, description, quantity, buy_price, sell_price,
        group_name, group_sort, sort_order, status,
        quantity_invoiced, product_id, deal_reg_line_id,
        products(id, name, sku)
      )
    `)
    .eq('id', soId)
    .eq('org_id', user.orgId)
    .single()

  if (soError) {
    console.error('[getSalesOrderForInvoice]', soError.message)
    return null
  }
  if (!so) return null

  // Get the quote and brand info
  let brand = null
  let quoteId = null
  if (so.quote_id) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, brand_id, vat_rate, brands(id, name, invoice_prefix)')
      .eq('id', so.quote_id)
      .single()
    if (quote) {
      quoteId = quote.id
      brand = quote.brands
    }
  }

  // Get contacts for the company
  const { data: rawContacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email')
    .eq('customer_id', so.customer_id)
    .eq('is_active', true)
    .order('first_name')

  // Check if customer is a group member — fetch parent company contacts
  let groupContacts: { id: string; first_name: string; last_name: string; email: string | null; group_name: string }[] = []
  const { data: memberships } = await supabase
    .from('company_group_members')
    .select('group_id, company_groups!inner(id, name, parent_company_id)')
    .eq('company_id', so.customer_id)

  if (memberships && memberships.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstGroup = (memberships[0] as any).company_groups
    if (firstGroup?.parent_company_id) {
      const { data: parentContacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .eq('customer_id', firstGroup.parent_company_id)
        .eq('is_active', true)
        .order('first_name')
      if (parentContacts) {
        groupContacts = decryptContactRows(parentContacts).map(c => ({
          ...c,
          group_name: firstGroup.name as string,
        }))
      }
    }
  }

  return {
    ...so,
    lines: (so.sales_order_lines || []).sort((a: { group_sort: number; sort_order: number }, b: { group_sort: number; sort_order: number }) =>
      a.group_sort !== b.group_sort ? a.group_sort - b.group_sort : a.sort_order - b.sort_order
    ),
    brand,
    quoteId,
    contacts: decryptContactRows(rawContacts || []),
    groupContacts,
  }
}

// --- Create Invoice ---

interface CreateInvoiceInput {
  salesOrderId: string
  contactId: string | null
  paymentTerms: number
  invoiceType: 'standard' | 'proforma'
  internalNotes: string
  lines: {
    salesOrderLineId: string
    quantity: number
    unitPrice: number
    unitCost: number
    vatRate: number
    description: string
    productId: string | null
    sortOrder: number
    groupName: string | null
  }[]
}

export async function createInvoice(input: CreateInvoiceInput) {
  const user = await requirePermission('invoices', 'create')
  const supabase = await createClient()

  // Validate lines
  if (!input.lines || input.lines.length === 0) {
    return { error: 'At least one line item is required.' }
  }

  // Fetch SO
  const { data: so } = await supabase
    .from('sales_orders')
    .select('*, sales_order_lines(id, quantity, quantity_invoiced)')
    .eq('id', input.salesOrderId)
    .single()

  if (!so) return { error: 'Sales order not found.' }

  // Validate quantities
  const soLineMap = new Map<string, { quantity: number; quantity_invoiced: number }>()
  for (const line of so.sales_order_lines || []) {
    soLineMap.set(line.id, { quantity: line.quantity, quantity_invoiced: line.quantity_invoiced || 0 })
  }

  for (const line of input.lines) {
    const soLine = soLineMap.get(line.salesOrderLineId)
    if (!soLine) return { error: `SO line not found: ${line.salesOrderLineId}` }
    const remaining = soLine.quantity - soLine.quantity_invoiced
    if (line.quantity > remaining + 0.001) {
      return { error: `Invoice quantity (${line.quantity}) exceeds remaining (${remaining}) for line "${line.description}".` }
    }
  }

  // Get brand info from quote
  let brandId: string | null = null
  let quoteId: string | null = null
  let invoicePrefix = 'INV'

  if (so.quote_id) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, brand_id, brands(invoice_prefix)')
      .eq('id', so.quote_id)
      .single()
    if (quote) {
      quoteId = quote.id
      brandId = quote.brand_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = quote.brands as any
      if (b && b.invoice_prefix) {
        invoicePrefix = b.invoice_prefix
      }
    }
  }

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(supabase, user.orgId, invoicePrefix)

  // Calculate totals
  const subtotal = input.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const vatRate = input.lines[0]?.vatRate ?? 20
  const vatAmount = subtotal * (vatRate / 100)
  const total = subtotal + vatAmount

  // Due date
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (input.paymentTerms || 30))

  // Insert invoice
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      org_id: user.orgId,
      sales_order_id: input.salesOrderId,
      customer_id: so.customer_id,
      invoice_number: invoiceNumber,
      status: 'draft',
      invoice_type: input.invoiceType,
      subtotal,
      vat_amount: vatAmount,
      total,
      vat_rate: vatRate,
      due_date: dueDate.toISOString().split('T')[0],
      notes: input.internalNotes || null,
      internal_notes: input.internalNotes || null,
      brand_id: brandId,
      quote_id: quoteId,
      contact_id: input.contactId,
      customer_po: so.customer_po || null,
      payment_terms: input.paymentTerms,
    })
    .select('id')
    .single()

  if (invError || !invoice) {
    console.error('[createInvoice]', invError?.message)
    return { error: invError?.message || 'Failed to create invoice.' }
  }

  // Insert lines
  const lineInserts = input.lines.map((l) => ({
    invoice_id: invoice.id,
    sales_order_line_id: l.salesOrderLineId,
    product_id: l.productId,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    unit_cost: l.unitCost,
    vat_rate: l.vatRate,
    sort_order: l.sortOrder,
    group_name: l.groupName,
  }))

  const { error: linesError } = await supabase
    .from('invoice_lines')
    .insert(lineInserts)

  if (linesError) {
    // Cleanup the invoice if lines fail
    await supabase.from('invoices').delete().eq('id', invoice.id)
    console.error('[createInvoice lines]', linesError.message)
    return { error: 'Failed to create invoice lines.' }
  }

  // Update quantity_invoiced on SO lines
  for (const line of input.lines) {
    const soLine = soLineMap.get(line.salesOrderLineId)
    if (soLine) {
      await supabase
        .from('sales_order_lines')
        .update({ quantity_invoiced: (soLine.quantity_invoiced || 0) + line.quantity })
        .eq('id', line.salesOrderLineId)
    }
  }

  // Activity log
  logActivity({
    supabase,
    user,
    entityType: 'invoice',
    entityId: invoice.id,
    action: 'invoice.created',
    details: {
      invoice_number: invoiceNumber,
      sales_order_id: input.salesOrderId,
      so_number: so.so_number,
      customer_id: so.customer_id,
      total,
      line_count: input.lines.length,
      invoice_type: input.invoiceType,
    },
  })

  revalidatePath('/invoices')
  revalidatePath(`/orders/${input.salesOrderId}`)

  return { success: true, invoiceId: invoice.id, invoiceNumber }
}

// --- Update Invoice (draft only) ---

interface UpdateInvoiceInput {
  invoiceId: string
  contactId: string | null
  paymentTerms: number
  internalNotes: string
  lines: {
    salesOrderLineId: string
    quantity: number
    unitPrice: number
    unitCost: number
    vatRate: number
    description: string
    productId: string | null
    sortOrder: number
    groupName: string | null
  }[]
}

export async function updateInvoice(input: UpdateInvoiceInput) {
  const user = await requirePermission('invoices', 'edit')
  const supabase = await createClient()

  // Get existing invoice
  const { data: existing } = await supabase
    .from('invoices')
    .select('*, invoice_lines(id, sales_order_line_id, quantity)')
    .eq('id', input.invoiceId)
    .single()

  if (!existing) return { error: 'Invoice not found.' }
  if (existing.status !== 'draft') return { error: 'Only draft invoices can be edited.' }

  // Reverse old quantity_invoiced
  for (const oldLine of existing.invoice_lines || []) {
    if (oldLine.sales_order_line_id) {
      const { data: soLine } = await supabase
        .from('sales_order_lines')
        .select('quantity_invoiced')
        .eq('id', oldLine.sales_order_line_id)
        .single()
      if (soLine) {
        await supabase
          .from('sales_order_lines')
          .update({ quantity_invoiced: Math.max(0, (soLine.quantity_invoiced || 0) - oldLine.quantity) })
          .eq('id', oldLine.sales_order_line_id)
      }
    }
  }

  // Delete old lines
  await supabase.from('invoice_lines').delete().eq('invoice_id', input.invoiceId)

  // Calculate new totals
  const subtotal = input.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const vatRate = input.lines[0]?.vatRate ?? 20
  const vatAmount = subtotal * (vatRate / 100)
  const total = subtotal + vatAmount

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (input.paymentTerms || 30))

  // Update invoice
  await supabase
    .from('invoices')
    .update({
      contact_id: input.contactId,
      payment_terms: input.paymentTerms,
      internal_notes: input.internalNotes || null,
      notes: input.internalNotes || null,
      subtotal,
      vat_amount: vatAmount,
      total,
      due_date: dueDate.toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.invoiceId)

  // Insert new lines
  const lineInserts = input.lines.map((l) => ({
    invoice_id: input.invoiceId,
    sales_order_line_id: l.salesOrderLineId,
    product_id: l.productId,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    unit_cost: l.unitCost,
    vat_rate: l.vatRate,
    sort_order: l.sortOrder,
    group_name: l.groupName,
  }))

  await supabase.from('invoice_lines').insert(lineInserts)

  // Apply new quantity_invoiced
  for (const line of input.lines) {
    const { data: soLine } = await supabase
      .from('sales_order_lines')
      .select('quantity_invoiced')
      .eq('id', line.salesOrderLineId)
      .single()
    if (soLine) {
      await supabase
        .from('sales_order_lines')
        .update({ quantity_invoiced: (soLine.quantity_invoiced || 0) + line.quantity })
        .eq('id', line.salesOrderLineId)
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'invoice',
    entityId: input.invoiceId,
    action: 'invoice.updated',
    details: { changed_fields: ['lines', 'contact', 'payment_terms', 'notes'] },
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${input.invoiceId}`)
  revalidatePath(`/orders/${existing.sales_order_id}`)

  return { success: true }
}

// --- Status changes ---

export async function sendInvoice(invoiceId: string) {
  const user = await requirePermission('invoices', 'edit')
  const supabase = await createClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status, invoice_number')
    .eq('id', invoiceId)
    .single()

  if (!inv) return { error: 'Invoice not found.' }
  if (inv.status !== 'draft') return { error: 'Only draft invoices can be sent.' }

  await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  logActivity({
    supabase,
    user,
    entityType: 'invoice',
    entityId: invoiceId,
    action: 'invoice.status_changed',
    details: { from: 'draft', to: 'sent' },
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${invoiceId}`)

  return { success: true }
}

export async function markInvoicePaid(invoiceId: string, paidDate: string) {
  const user = await requirePermission('invoices', 'edit')
  const supabase = await createClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status, invoice_number')
    .eq('id', invoiceId)
    .single()

  if (!inv) return { error: 'Invoice not found.' }
  if (!['sent', 'overdue'].includes(inv.status)) return { error: 'Only sent or overdue invoices can be marked as paid.' }

  await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: paidDate, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  logActivity({
    supabase,
    user,
    entityType: 'invoice',
    entityId: invoiceId,
    action: 'invoice.paid',
    details: { paid_at: paidDate, total: null },
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${invoiceId}`)

  return { success: true }
}

export async function voidInvoice(invoiceId: string, reason: string) {
  const user = await requirePermission('invoices', 'edit')
  const supabase = await createClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('status, invoice_number, invoice_lines(id, sales_order_line_id, quantity)')
    .eq('id', invoiceId)
    .single()

  if (!inv) return { error: 'Invoice not found.' }
  if (inv.status === 'void') return { error: 'Invoice is already void.' }
  if (inv.status === 'paid') return { error: 'Paid invoices cannot be voided. Create a credit note instead.' }

  // Reverse quantity_invoiced on SO lines
  for (const line of inv.invoice_lines || []) {
    if (line.sales_order_line_id) {
      const { data: soLine } = await supabase
        .from('sales_order_lines')
        .select('quantity_invoiced')
        .eq('id', line.sales_order_line_id)
        .single()
      if (soLine) {
        await supabase
          .from('sales_order_lines')
          .update({ quantity_invoiced: Math.max(0, (soLine.quantity_invoiced || 0) - line.quantity) })
          .eq('id', line.sales_order_line_id)
      }
    }
  }

  await supabase
    .from('invoices')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  logActivity({
    supabase,
    user,
    entityType: 'invoice',
    entityId: invoiceId,
    action: 'invoice.voided',
    details: { reason },
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${invoiceId}`)

  return { success: true }
}

// --- Credit Note ---

interface CreateCreditNoteInput {
  parentInvoiceId: string
  lines: {
    salesOrderLineId: string
    quantity: number
    unitPrice: number
    unitCost: number
    vatRate: number
    description: string
    productId: string | null
    sortOrder: number
    groupName: string | null
  }[]
}

export async function createCreditNote(input: CreateCreditNoteInput) {
  const user = await requirePermission('invoices', 'create')
  const supabase = await createClient()

  const { data: parent } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', input.parentInvoiceId)
    .single()

  if (!parent) return { error: 'Parent invoice not found.' }
  if (!['sent', 'paid', 'overdue'].includes(parent.status)) {
    return { error: 'Credit notes can only be raised against sent, paid, or overdue invoices.' }
  }

  // Get brand prefix
  let invoicePrefix = 'INV'
  if (parent.brand_id) {
    const { data: brand } = await supabase
      .from('brands')
      .select('invoice_prefix')
      .eq('id', parent.brand_id)
      .single()
    if (brand?.invoice_prefix) invoicePrefix = brand.invoice_prefix
  }

  // Count existing credit notes for this parent
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('parent_invoice_id', input.parentInvoiceId)
    .eq('invoice_type', 'credit_note')

  const cnNumber = `${parent.invoice_number}-CN${(count || 0) + 1}`

  // Calculate totals (stored as negative)
  const subtotal = -(input.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0))
  const vatRate = input.lines[0]?.vatRate ?? 20
  const vatAmount = subtotal * (vatRate / 100)
  const total = subtotal + vatAmount

  const { data: cn, error: cnError } = await supabase
    .from('invoices')
    .insert({
      org_id: user.orgId,
      sales_order_id: parent.sales_order_id,
      customer_id: parent.customer_id,
      invoice_number: cnNumber,
      status: 'credit_note',
      invoice_type: 'credit_note',
      subtotal,
      vat_amount: vatAmount,
      total,
      vat_rate: vatRate,
      brand_id: parent.brand_id,
      quote_id: parent.quote_id,
      contact_id: parent.contact_id,
      parent_invoice_id: input.parentInvoiceId,
      customer_po: parent.customer_po,
      payment_terms: parent.payment_terms,
    })
    .select('id')
    .single()

  if (cnError || !cn) {
    console.error('[createCreditNote]', cnError?.message)
    return { error: 'Failed to create credit note.' }
  }

  // Insert lines (positive quantities, but totals are negative on the invoice)
  const lineInserts = input.lines.map((l) => ({
    invoice_id: cn.id,
    sales_order_line_id: l.salesOrderLineId,
    product_id: l.productId,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    unit_cost: l.unitCost,
    vat_rate: l.vatRate,
    sort_order: l.sortOrder,
    group_name: l.groupName,
  }))

  await supabase.from('invoice_lines').insert(lineInserts)

  // Decrement quantity_invoiced on SO lines (freeing for re-invoicing)
  for (const line of input.lines) {
    const { data: soLine } = await supabase
      .from('sales_order_lines')
      .select('quantity_invoiced')
      .eq('id', line.salesOrderLineId)
      .single()
    if (soLine) {
      await supabase
        .from('sales_order_lines')
        .update({ quantity_invoiced: Math.max(0, (soLine.quantity_invoiced || 0) - line.quantity) })
        .eq('id', line.salesOrderLineId)
    }
  }

  logActivity({
    supabase,
    user,
    entityType: 'invoice',
    entityId: cn.id,
    action: 'invoice.credit_note_created',
    details: {
      parent_invoice_id: input.parentInvoiceId,
      parent_invoice_number: parent.invoice_number,
      credit_total: total,
    },
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${input.parentInvoiceId}`)
  revalidatePath(`/orders/${parent.sales_order_id}`)

  return { success: true, invoiceId: cn.id, invoiceNumber: cnNumber }
}

// --- Get invoices for a sales order ---

export async function getInvoicesForSalesOrder(soId: string) {
  await requirePermission('invoices', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, invoice_type, total, paid_at, created_at, due_date')
    .eq('sales_order_id', soId)
    .order('created_at', { ascending: true })

  return (data || []).map((inv) => ({
    ...inv,
    effectiveStatus: getEffectiveInvoiceStatus(inv.status, inv.due_date),
  }))
}

// --- Seed invoices ---

export async function seedInvoices() {
  const user = await requirePermission('invoices', 'create')
  const supabase = await createClient()

  // Check if invoices already exist
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('org_id', user.orgId)
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'Invoices already exist. Seed is idempotent.' }
  }

  // Find the first SO with lines
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select(`
      id, so_number, customer_id, customer_po, quote_id, vat_rate, org_id,
      sales_order_lines(id, description, quantity, buy_price, sell_price, group_name, group_sort, sort_order, product_id, quantity_invoiced)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: true })
    .limit(2)

  if (!salesOrders || salesOrders.length === 0) {
    return { error: 'No sales orders found. Seed sales orders first.' }
  }

  const so = salesOrders[0]
  const lines = (so.sales_order_lines || []).sort((a: { group_sort: number; sort_order: number }, b: { group_sort: number; sort_order: number }) =>
    a.group_sort !== b.group_sort ? a.group_sort - b.group_sort : a.sort_order - b.sort_order
  )

  if (lines.length === 0) {
    return { error: 'Sales order has no lines.' }
  }

  // Get brand
  let brandId: string | null = null
  let quoteId: string | null = null
  let invoicePrefix = 'INV'
  if (so.quote_id) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, brand_id, brands(invoice_prefix)')
      .eq('id', so.quote_id)
      .single()
    if (quote) {
      quoteId = quote.id
      brandId = quote.brand_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = quote.brands as any
      if (b && b.invoice_prefix) {
        invoicePrefix = b.invoice_prefix
      }
    }
  }

  // If no brand prefix from quote, check default brand
  if (invoicePrefix === 'INV') {
    const { data: defaultBrand } = await supabase
      .from('brands')
      .select('id, invoice_prefix')
      .eq('org_id', user.orgId)
      .eq('is_default', true)
      .single()
    if (defaultBrand) {
      if (!brandId) brandId = defaultBrand.id
      if (defaultBrand.invoice_prefix) invoicePrefix = defaultBrand.invoice_prefix
    }
  }

  const invoiceNumber = await generateInvoiceNumber(supabase, user.orgId, invoicePrefix)

  // Invoice 1: Full invoice, sent
  const subtotal1 = lines.reduce((sum: number, l: { quantity: number; sell_price: number }) => sum + l.quantity * l.sell_price, 0)
  const vatRate = so.vat_rate || 20
  const vatAmount1 = subtotal1 * (vatRate / 100)
  const total1 = subtotal1 + vatAmount1

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const { data: inv1 } = await supabase
    .from('invoices')
    .insert({
      org_id: user.orgId,
      sales_order_id: so.id,
      customer_id: so.customer_id,
      invoice_number: invoiceNumber,
      status: 'sent',
      invoice_type: 'standard',
      subtotal: subtotal1,
      vat_amount: vatAmount1,
      total: total1,
      vat_rate: vatRate,
      due_date: dueDate.toISOString().split('T')[0],
      sent_at: new Date().toISOString(),
      brand_id: brandId,
      quote_id: quoteId,
      customer_po: so.customer_po,
      payment_terms: 30,
    })
    .select('id')
    .single()

  if (inv1) {
    // Insert lines
    const invLines = lines.map((l: { id: string; description: string; quantity: number; buy_price: number; sell_price: number; product_id: string | null; sort_order: number; group_name: string | null }, idx: number) => ({
      invoice_id: inv1.id,
      sales_order_line_id: l.id,
      product_id: l.product_id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.sell_price,
      unit_cost: l.buy_price,
      vat_rate: vatRate,
      sort_order: idx,
      group_name: l.group_name,
    }))
    await supabase.from('invoice_lines').insert(invLines)

    // Update quantity_invoiced
    for (const l of lines) {
      await supabase
        .from('sales_order_lines')
        .update({ quantity_invoiced: l.quantity })
        .eq('id', l.id)
    }

    logActivity({
      supabase,
      user,
      entityType: 'invoice',
      entityId: inv1.id,
      action: 'invoice.created',
      details: { invoice_number: invoiceNumber, sales_order_id: so.id, so_number: so.so_number, total: total1, line_count: lines.length, source: 'seed' },
    })
  }

  revalidatePath('/invoices')
  revalidatePath('/orders')

  return { success: true, invoiceNumber }
}
