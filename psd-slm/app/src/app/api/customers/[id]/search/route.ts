import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

interface SearchResult {
  type: string
  id: string
  label: string
  sub: string | null
  status: string | null
  href: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: customerId } = await params
  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()
  const orgId = user.orgId
  const results: SearchResult[] = []

  // Run all searches in parallel
  const [
    contactsRes,
    quotesRes,
    opportunitiesRes,
    salesOrdersRes,
    purchaseOrdersRes,
    ticketsRes,
    invoicesRes,
    jobsRes,
    contractsRes,
    dealRegsRes,
  ] = await Promise.all([
    // Contacts
    supabase
      .from('contacts')
      .select('id, first_name, last_name, email, job_title')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,job_title.ilike.%${q}%`)
      .limit(5),

    // Quotes
    supabase
      .from('quotes')
      .select('id, quote_number, title, status, customer_po')
      .eq('customer_id', customerId)
      .eq('org_id', orgId)
      .not('status', 'eq', 'revised')
      .or(`quote_number.ilike.%${q}%,title.ilike.%${q}%,customer_po.ilike.%${q}%`)
      .limit(5),

    // Opportunities
    supabase
      .from('opportunities')
      .select('id, title, stage, estimated_value')
      .eq('customer_id', customerId)
      .eq('org_id', orgId)
      .ilike('title', `%${q}%`)
      .limit(5),

    // Sales Orders
    supabase
      .from('sales_orders')
      .select('id, so_number, status, customer_po')
      .eq('customer_id', customerId)
      .eq('org_id', orgId)
      .or(`so_number.ilike.%${q}%,customer_po.ilike.%${q}%`)
      .limit(5),

    // Purchase Orders (via sales_orders join)
    supabase
      .from('purchase_orders')
      .select('id, po_number, status, supplier_ref, suppliers!inner(name), sales_orders!inner(customer_id)')
      .eq('sales_orders.customer_id', customerId)
      .eq('org_id', orgId)
      .or(`po_number.ilike.%${q}%,supplier_ref.ilike.%${q}%`)
      .limit(5),

    // Tickets
    supabase
      .from('tickets')
      .select('id, ticket_number, subject, status')
      .eq('customer_id', customerId)
      .eq('org_id', orgId)
      .or(`ticket_number.ilike.%${q}%,subject.ilike.%${q}%`)
      .limit(5),

    // Invoices
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total')
      .eq('customer_id', customerId)
      .eq('org_id', orgId)
      .or(`invoice_number.ilike.%${q}%`)
      .limit(5),

    // Jobs (uses company_id)
    supabase
      .from('jobs')
      .select('id, job_number, title, status')
      .eq('company_id', customerId)
      .eq('org_id', orgId)
      .or(`job_number.ilike.%${q}%,title.ilike.%${q}%`)
      .limit(5),

    // Customer Contracts
    supabase
      .from('customer_contracts')
      .select('id, contract_number, status, contract_types!inner(name)')
      .eq('customer_id', customerId)
      .eq('org_id', orgId)
      .or(`contract_number.ilike.%${q}%`)
      .limit(5),

    // Deal Registrations
    supabase
      .from('deal_registrations')
      .select('id, reference, title, status')
      .eq('customer_id', customerId)
      .eq('org_id', orgId)
      .or(`reference.ilike.%${q}%,title.ilike.%${q}%`)
      .limit(5),
  ])

  // Map contacts
  for (const c of contactsRes.data || []) {
    results.push({
      type: 'Contact',
      id: c.id,
      label: `${c.first_name} ${c.last_name}`,
      sub: c.email || c.job_title || null,
      status: null,
      href: `/customers/${customerId}`,
    })
  }

  // Map quotes
  for (const q of quotesRes.data || []) {
    results.push({
      type: 'Quote',
      id: q.id,
      label: q.quote_number,
      sub: q.title || (q.customer_po ? `PO: ${q.customer_po}` : null),
      status: q.status,
      href: `/quotes/${q.id}`,
    })
  }

  // Map opportunities
  for (const o of opportunitiesRes.data || []) {
    results.push({
      type: 'Opportunity',
      id: o.id,
      label: o.title,
      sub: o.estimated_value ? `£${Number(o.estimated_value).toLocaleString('en-GB')}` : null,
      status: o.stage,
      href: `/opportunities/${o.id}`,
    })
  }

  // Map sales orders
  for (const so of salesOrdersRes.data || []) {
    results.push({
      type: 'Sales Order',
      id: so.id,
      label: so.so_number,
      sub: so.customer_po ? `PO: ${so.customer_po}` : null,
      status: so.status,
      href: `/sales-orders/${so.id}`,
    })
  }

  // Map purchase orders
  for (const po of purchaseOrdersRes.data || []) {
    const supplierName = (po.suppliers as unknown as { name: string })?.name || null
    results.push({
      type: 'Purchase Order',
      id: po.id,
      label: po.po_number,
      sub: supplierName || (po.supplier_ref ? `Ref: ${po.supplier_ref}` : null),
      status: po.status,
      href: `/purchase-orders/${po.id}`,
    })
  }

  // Map tickets
  for (const t of ticketsRes.data || []) {
    results.push({
      type: 'Ticket',
      id: t.id,
      label: t.ticket_number,
      sub: t.subject,
      status: t.status,
      href: `/helpdesk/tickets/${t.id}`,
    })
  }

  // Map invoices
  for (const inv of invoicesRes.data || []) {
    results.push({
      type: 'Invoice',
      id: inv.id,
      label: inv.invoice_number,
      sub: inv.total ? `£${Number(inv.total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : null,
      status: inv.status,
      href: `/invoices/${inv.id}`,
    })
  }

  // Map jobs
  for (const j of jobsRes.data || []) {
    results.push({
      type: 'Job',
      id: j.id,
      label: j.job_number,
      sub: j.title,
      status: j.status,
      href: `/scheduling/jobs/${j.id}`,
    })
  }

  // Map contracts
  for (const c of contractsRes.data || []) {
    const typeName = (c.contract_types as unknown as { name: string })?.name || null
    results.push({
      type: 'Contract',
      id: c.id,
      label: c.contract_number,
      sub: typeName,
      status: c.status,
      href: `/contracts/${c.id}`,
    })
  }

  // Map deal registrations
  for (const dr of dealRegsRes.data || []) {
    results.push({
      type: 'Deal Reg',
      id: dr.id,
      label: dr.reference || dr.title,
      sub: dr.reference ? dr.title : null,
      status: dr.status,
      href: `/deal-registrations/${dr.id}`,
    })
  }

  return NextResponse.json({ results })
}
