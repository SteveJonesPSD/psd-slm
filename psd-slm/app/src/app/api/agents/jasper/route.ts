import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { decryptContactRow, decryptCustomerRow } from '@/lib/crypto-helpers'
import { deriveSoStatus } from '@/lib/sales-orders'

const MAX_ITERATIONS = 10

// --- Types ---

interface AppUser {
  id: string
  orgId: string
  firstName: string
  lastName: string
  role: string
  permissions: string[]
}

type SupabaseInstance = Awaited<ReturnType<typeof createClient>>

// --- Auth helper ---

async function getAppUser(supabase: SupabaseInstance): Promise<AppUser | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: appUser } = await supabase
    .from('users')
    .select('id, org_id, first_name, last_name, role_id, roles(name)')
    .eq('auth_id', authUser.id)
    .eq('is_active', true)
    .single()

  if (!appUser) return null

  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permissions(module, action)')
    .eq('role_id', appUser.role_id)

  const role = appUser.roles as unknown as { name: string }
  const permissions = (rolePerms || []).map((rp) => {
    const perm = rp.permissions as unknown as { module: string; action: string }
    return `${perm.module}.${perm.action}`
  })

  return {
    id: appUser.id,
    orgId: appUser.org_id,
    firstName: appUser.first_name,
    lastName: appUser.last_name,
    role: role.name,
    permissions,
  }
}

// --- System prompt ---

function buildSystemPrompt(user: AppUser): string {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return `You are Jasper, PSD Group's AI sales assistant within the Innov8iv Engage platform. You help staff with pipeline questions, quote preparation, deal registration guidance, customer insights, sales order tracking, and sales strategy.

## Your identity
- Professional, concise, and helpful. Use British English.
- Format currency as GBP (e.g. £1,234.56).
- Margin colour coding: green ≥30%, amber ≥15%, red <15%.
- Quote numbers: Q-YYYY-NNNN. SO numbers: SO-YYYY-NNNN. PO numbers: PO-YYYY-NNNN.

## Current user
- Name: ${user.firstName} ${user.lastName}
- Role: ${user.role}
- Date: ${today}

## Your capabilities
You have access to tools that query live sales data from the Engage database. Use them to answer questions accurately. Available operations:
- Search and view quotes, sales orders, customers, products
- Check deal registration pricing for customers
- View pipeline summary (opportunities by stage)
- Create draft quotes (always in draft status — the user must review and send)

## Formatting
- Your responses support Markdown — use **bold**, *italic*, bullet points, numbered lists, and tables
- CRITICAL: When referencing quotes, orders, customers, or any records, ALWAYS use markdown links with the record's UUID from your tool results. The link MUST point to the detail page, not the list page. Examples:
  - Quote: [Q-2026-0019](/quotes/7e147371-9011-4ff3-92ca-d55c45371448) — uses the quote's "id" field
  - Sales Order: [SO-2026-0001](/orders/{id})
  - Customer: [Hartwell Commercial Properties](/customers/{id})
- In tables, ALWAYS make the reference number column a markdown link: | [Q-2026-0019](/quotes/{id}) | ...
- Tables MUST have a MAXIMUM of 3 columns. Your responses are displayed in a narrow chat bubble — wide tables break the layout. For quote lists use: Quote | Value | Status. Put any extra detail (date, margin, customer) in a summary sentence below the table, not in extra columns.
- Keep column content short — abbreviate where possible (e.g. "3 Mar" not "3rd March 2026").
- NEVER output a quote number like Q-2026-0019 without making it a markdown link to /quotes/{id}
- Do NOT output bare URLs — always wrap them in markdown link syntax

## Rules
1. Always use your tools to look up data rather than guessing. If unsure, search first.
2. When creating quotes, ALWAYS check deal registrations first. If a customer has an active deal reg for a product, use the deal reg buy price, not the catalogue default.
3. Quotes you create are always draft status. You cannot send, accept, decline, delete, or edit existing quotes.
4. Present financial data clearly — show line-by-line breakdowns with quantities, buy/sell prices, and margins.
5. If you don't have permission or can't find data, say so honestly.
6. Keep responses concise. Use tables or lists for structured data.`
}

// --- Tool definitions ---

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_quotes',
    description: 'Search quotes by customer name, quote number, status, or assigned user. Returns a list of matching quotes with totals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Filter by customer name (partial match)' },
        quote_number: { type: 'string', description: 'Filter by quote number (partial match)' },
        status: { type: 'string', description: 'Filter by status: draft, review, sent, accepted, declined, revised, lost' },
        assigned_user_name: { type: 'string', description: 'Filter by assigned user first name' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_quote_details',
    description: 'Get full details of a specific quote including line items, groups, attributions, and totals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        quote_id: { type: 'string', description: 'The quote UUID' },
      },
      required: ['quote_id'],
    },
  },
  {
    name: 'search_sales_orders',
    description: 'Search sales orders by customer name, SO number, status, or customer PO reference.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Filter by customer name (partial match)' },
        so_number: { type: 'string', description: 'Filter by SO number (partial match)' },
        status: { type: 'string', description: 'Filter by derived status: pending, in_progress, partially_fulfilled, fulfilled, cancelled' },
        customer_po: { type: 'string', description: 'Filter by customer PO reference (partial match)' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_sales_order_details',
    description: 'Get full details of a specific sales order including lines with fulfilment status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sales_order_id: { type: 'string', description: 'The sales order UUID' },
      },
      required: ['sales_order_id'],
    },
  },
  {
    name: 'search_customers',
    description: 'Search customers by name, type, or account manager.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Filter by customer name (partial match)' },
        customer_type: { type: 'string', description: 'Filter by type: business, education, charity, public_sector' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_customer_details',
    description: 'Get full customer details including contacts, recent quotes, recent sales orders, and active deal registrations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: { type: 'string', description: 'The customer UUID' },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'search_products',
    description: 'Search products by name, SKU, or manufacturer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term to match against product name, SKU, or manufacturer' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_deal_registrations',
    description: 'Get active deal registration pricing for a specific customer. Returns products with special buy prices.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: { type: 'string', description: 'The customer UUID' },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get a summary of the sales pipeline — opportunities grouped by stage with counts and total values.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_draft_quote',
    description: 'Create a new quote in draft status. Always check deal registrations for the customer first to get correct buy prices. The quote must be reviewed by the user before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: { type: 'string', description: 'The customer UUID' },
        contact_id: { type: 'string', description: 'Optional contact UUID' },
        opportunity_id: { type: 'string', description: 'Optional linked opportunity UUID' },
        quote_type: { type: 'string', description: 'Quote type: business, education, charity, public_sector' },
        valid_until: { type: 'string', description: 'Expiry date in YYYY-MM-DD format' },
        customer_notes: { type: 'string', description: 'Notes visible to the customer' },
        internal_notes: { type: 'string', description: 'Internal-only notes' },
        groups: {
          type: 'array',
          description: 'Line item groups',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Group name' },
              lines: {
                type: 'array',
                description: 'Line items in this group',
                items: {
                  type: 'object',
                  properties: {
                    product_id: { type: 'string', description: 'Product UUID (null for ad-hoc lines)' },
                    supplier_id: { type: 'string', description: 'Supplier UUID' },
                    deal_reg_line_id: { type: 'string', description: 'Deal registration line UUID if using DR pricing' },
                    description: { type: 'string', description: 'Line description' },
                    quantity: { type: 'number', description: 'Quantity' },
                    buy_price: { type: 'number', description: 'Buy price per unit' },
                    sell_price: { type: 'number', description: 'Sell price per unit' },
                    fulfilment_route: { type: 'string', description: 'from_stock or drop_ship (default: drop_ship)' },
                  },
                  required: ['description', 'quantity', 'buy_price', 'sell_price'],
                },
              },
            },
            required: ['name', 'lines'],
          },
        },
      },
      required: ['customer_id', 'groups'],
    },
  },
]

// --- Tool handlers ---

async function handleSearchQuotes(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { customer_name?: string; quote_number?: string; status?: string; assigned_user_name?: string; limit?: number }
): Promise<string> {
  const limit = input.limit || 20

  let query = supabase
    .from('quotes')
    .select(`
      id, quote_number, status, version, quote_type, created_at, valid_until, sent_at, accepted_at,
      customers(id, name),
      users!quotes_assigned_to_fkey(id, first_name, last_name),
      quote_lines(quantity, buy_price, sell_price, is_optional)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.quote_number) {
    query = query.ilike('quote_number', `%${input.quote_number}%`)
  }
  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data: quotes, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!quotes || quotes.length === 0) return JSON.stringify({ results: [], message: 'No quotes found matching your criteria.' })

  // Post-filter by customer name and assigned user (FK joins don't support ilike)
  let filtered = quotes as (typeof quotes[0])[]

  if (input.customer_name) {
    const search = input.customer_name.toLowerCase()
    filtered = filtered.filter((q) => {
      const customer = q.customers as unknown as { name: string } | null
      return customer?.name?.toLowerCase().includes(search)
    })
  }

  if (input.assigned_user_name) {
    const search = input.assigned_user_name.toLowerCase()
    filtered = filtered.filter((q) => {
      const u = q.users as unknown as { first_name: string; last_name: string } | null
      return u?.first_name?.toLowerCase().includes(search) || u?.last_name?.toLowerCase().includes(search)
    })
  }

  const results = filtered.map((q) => {
    const customer = q.customers as unknown as { id: string; name: string } | null
    const assignedUser = q.users as unknown as { first_name: string; last_name: string } | null
    const lines = (q.quote_lines || []) as { quantity: number; buy_price: number; sell_price: number; is_optional: boolean }[]
    const firmLines = lines.filter((l) => !l.is_optional)
    const subtotal = firmLines.reduce((s, l) => s + l.quantity * l.sell_price, 0)
    const totalCost = firmLines.reduce((s, l) => s + l.quantity * l.buy_price, 0)
    const margin = subtotal > 0 ? ((subtotal - totalCost) / subtotal) * 100 : 0

    return {
      id: q.id,
      quote_number: q.quote_number,
      status: q.status,
      version: q.version,
      quote_type: q.quote_type,
      customer: customer?.name || 'Unknown',
      customer_id: customer?.id,
      assigned_to: assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : 'Unassigned',
      line_count: lines.length,
      subtotal,
      total_cost: totalCost,
      margin_pct: Math.round(margin * 10) / 10,
      created_at: q.created_at,
      valid_until: q.valid_until,
      link: `/quotes/${q.id}`,
    }
  })

  return JSON.stringify({ results, count: results.length })
}

async function handleGetQuoteDetails(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { quote_id: string }
): Promise<string> {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', input.quote_id)
    .eq('org_id', user.orgId)
    .single()

  if (error || !quote) return JSON.stringify({ error: 'Quote not found.' })

  const [
    { data: customer },
    { data: contact },
    { data: assignedUser },
    { data: groups },
    { data: lines },
    { data: attributions },
  ] = await Promise.all([
    supabase.from('customers').select('id, name').eq('id', quote.customer_id).single(),
    quote.contact_id
      ? supabase.from('contacts').select('id, first_name, last_name, email, phone').eq('id', quote.contact_id).single()
      : Promise.resolve({ data: null }),
    quote.assigned_to
      ? supabase.from('users').select('id, first_name, last_name').eq('id', quote.assigned_to).single()
      : Promise.resolve({ data: null }),
    supabase.from('quote_groups').select('*').eq('quote_id', input.quote_id).order('sort_order'),
    supabase.from('quote_lines').select('*, products(name, sku), suppliers(name)').eq('quote_id', input.quote_id).order('sort_order'),
    supabase.from('quote_attributions').select('*, users(first_name, last_name)').eq('quote_id', input.quote_id),
  ])

  type LineRow = {
    id: string; group_id: string | null; description: string; quantity: number;
    buy_price: number; sell_price: number; fulfilment_route: string; is_optional: boolean;
    requires_contract: boolean; deal_reg_line_id: string | null; notes: string | null;
    products: { name: string; sku: string } | null; suppliers: { name: string } | null
  }
  const allLines = (lines || []) as LineRow[]
  const firmLines = allLines.filter((l) => !l.is_optional)
  const subtotal = firmLines.reduce((s, l) => s + l.quantity * l.sell_price, 0)
  const totalCost = firmLines.reduce((s, l) => s + l.quantity * l.buy_price, 0)
  const margin = subtotal > 0 ? ((subtotal - totalCost) / subtotal) * 100 : 0

  type GroupRow = { id: string; name: string; sort_order: number }
  const typedGroups = (groups || []) as GroupRow[]

  const groupedLines = typedGroups.map((g) => ({
    group_name: g.name,
    lines: allLines
      .filter((l) => l.group_id === g.id)
      .map((l) => ({
        description: l.description,
        product_sku: l.products?.sku || null,
        supplier: l.suppliers?.name || null,
        quantity: l.quantity,
        buy_price: l.buy_price,
        sell_price: l.sell_price,
        line_total: l.quantity * l.sell_price,
        margin_pct: l.sell_price > 0 ? Math.round(((l.sell_price - l.buy_price) / l.sell_price) * 1000) / 10 : 0,
        fulfilment_route: l.fulfilment_route,
        is_optional: l.is_optional,
        has_deal_reg: !!l.deal_reg_line_id,
      })),
  }))

  const ungrouped = allLines
    .filter((l) => !l.group_id)
    .map((l) => ({
      description: l.description,
      product_sku: l.products?.sku || null,
      supplier: l.suppliers?.name || null,
      quantity: l.quantity,
      buy_price: l.buy_price,
      sell_price: l.sell_price,
      line_total: l.quantity * l.sell_price,
      margin_pct: l.sell_price > 0 ? Math.round(((l.sell_price - l.buy_price) / l.sell_price) * 1000) / 10 : 0,
      fulfilment_route: l.fulfilment_route,
      is_optional: l.is_optional,
      has_deal_reg: !!l.deal_reg_line_id,
    }))

  const attrList = (attributions || []).map((a) => {
    const u = a.users as unknown as { first_name: string; last_name: string } | null
    return {
      user: u ? `${u.first_name} ${u.last_name}` : 'Unknown',
      type: a.attribution_type,
      split_pct: a.split_pct,
    }
  })

  return JSON.stringify({
    quote_number: quote.quote_number,
    status: quote.status,
    version: quote.version,
    quote_type: quote.quote_type,
    customer: (customer as { name: string } | null)?.name || 'Unknown',
    customer_id: quote.customer_id,
    contact: contact ? `${contact.first_name} ${contact.last_name}` : null,
    assigned_to: assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : null,
    created_at: quote.created_at,
    sent_at: quote.sent_at,
    accepted_at: quote.accepted_at,
    valid_until: quote.valid_until,
    customer_po: quote.customer_po,
    vat_rate: quote.vat_rate,
    customer_notes: quote.customer_notes,
    internal_notes: quote.internal_notes,
    subtotal,
    total_cost: totalCost,
    margin_pct: Math.round(margin * 10) / 10,
    vat_amount: subtotal * (quote.vat_rate / 100),
    grand_total: subtotal * (1 + quote.vat_rate / 100),
    line_count: allLines.length,
    firm_line_count: firmLines.length,
    grouped_lines: groupedLines,
    ungrouped_lines: ungrouped,
    attributions: attrList,
    link: `/quotes/${quote.id}`,
  })
}

async function handleSearchSalesOrders(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { customer_name?: string; so_number?: string; status?: string; customer_po?: string; limit?: number }
): Promise<string> {
  const limit = input.limit || 20

  let query = supabase
    .from('sales_orders')
    .select(`
      id, so_number, customer_po, quote_number, created_at, accepted_at, notes,
      customers(id, name),
      users!sales_orders_assigned_to_fkey(id, first_name, last_name),
      sales_order_lines(id, status, quantity, buy_price, sell_price)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.so_number) {
    query = query.ilike('so_number', `%${input.so_number}%`)
  }
  if (input.customer_po) {
    query = query.ilike('customer_po', `%${input.customer_po}%`)
  }

  const { data: orders, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!orders || orders.length === 0) return JSON.stringify({ results: [], message: 'No sales orders found.' })

  let filtered = orders as (typeof orders[0])[]

  if (input.customer_name) {
    const search = input.customer_name.toLowerCase()
    filtered = filtered.filter((o) => {
      const customer = o.customers as unknown as { name: string } | null
      return customer?.name?.toLowerCase().includes(search)
    })
  }

  const results = filtered.map((o) => {
    const customer = o.customers as unknown as { id: string; name: string } | null
    const assignedUser = o.users as unknown as { first_name: string; last_name: string } | null
    const lines = (o.sales_order_lines || []) as { id: string; status: string; quantity: number; buy_price: number; sell_price: number }[]
    const derived = deriveSoStatus(lines)
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.sell_price, 0)
    const totalCost = lines.reduce((s, l) => s + l.quantity * l.buy_price, 0)

    return {
      id: o.id,
      so_number: o.so_number,
      derived_status: derived,
      customer: customer?.name || 'Unknown',
      customer_id: customer?.id,
      assigned_to: assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : 'Unassigned',
      customer_po: o.customer_po,
      quote_number: o.quote_number,
      line_count: lines.length,
      subtotal,
      total_cost: totalCost,
      created_at: o.created_at,
      link: `/orders/${o.id}`,
    }
  })

  // Post-filter by derived status if requested
  const finalResults = input.status
    ? results.filter((r) => r.derived_status === input.status)
    : results

  return JSON.stringify({ results: finalResults, count: finalResults.length })
}

async function handleGetSalesOrderDetails(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { sales_order_id: string }
): Promise<string> {
  const { data: so, error } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', input.sales_order_id)
    .eq('org_id', user.orgId)
    .single()

  if (error || !so) return JSON.stringify({ error: 'Sales order not found.' })

  const [
    { data: customer },
    { data: contact },
    { data: assignedUser },
    { data: lines },
  ] = await Promise.all([
    supabase.from('customers').select('id, name').eq('id', so.customer_id).single(),
    so.contact_id
      ? supabase.from('contacts').select('id, first_name, last_name, email, phone').eq('id', so.contact_id).single()
      : Promise.resolve({ data: null }),
    so.assigned_to
      ? supabase.from('users').select('id, first_name, last_name').eq('id', so.assigned_to).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('sales_order_lines')
      .select('*, products(id, name, sku), suppliers(id, name)')
      .eq('sales_order_id', input.sales_order_id)
      .order('group_sort', { ascending: true })
      .order('sort_order', { ascending: true }),
  ])

  const allLines = (lines || []) as {
    id: string; description: string; quantity: number; buy_price: number; sell_price: number;
    status: string; fulfilment_route: string; delivery_destination: string | null;
    is_service: boolean; quantity_received: number; group_name: string | null;
    products: { name: string; sku: string } | null; suppliers: { name: string } | null
  }[]

  const derived = deriveSoStatus(allLines)
  const subtotal = allLines.reduce((s, l) => s + l.quantity * l.sell_price, 0)
  const totalCost = allLines.reduce((s, l) => s + l.quantity * l.buy_price, 0)
  const margin = subtotal > 0 ? ((subtotal - totalCost) / subtotal) * 100 : 0

  return JSON.stringify({
    so_number: so.so_number,
    derived_status: derived,
    customer: (customer as { name: string } | null)?.name || 'Unknown',
    customer_id: so.customer_id,
    contact: contact ? `${contact.first_name} ${contact.last_name}` : null,
    assigned_to: assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : null,
    customer_po: so.customer_po,
    quote_number: so.quote_number,
    created_at: so.created_at,
    accepted_at: so.accepted_at,
    delivery_address: [so.delivery_address_line1, so.delivery_address_line2, so.delivery_city, so.delivery_postcode].filter(Boolean).join(', '),
    requested_delivery_date: so.requested_delivery_date,
    requires_install: so.requires_install,
    requested_install_date: so.requested_install_date,
    notes: so.notes,
    subtotal,
    total_cost: totalCost,
    margin_pct: Math.round(margin * 10) / 10,
    lines: allLines.map((l) => ({
      description: l.description,
      product_sku: l.products?.sku || null,
      supplier: l.suppliers?.name || null,
      quantity: l.quantity,
      buy_price: l.buy_price,
      sell_price: l.sell_price,
      line_total: l.quantity * l.sell_price,
      status: l.status,
      fulfilment_route: l.fulfilment_route,
      delivery_destination: l.delivery_destination,
      is_service: l.is_service,
      quantity_received: l.quantity_received,
      group_name: l.group_name,
    })),
    link: `/orders/${so.id}`,
  })
}

async function handleSearchCustomers(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { name?: string; customer_type?: string; limit?: number }
): Promise<string> {
  const limit = input.limit || 20

  let query = supabase
    .from('customers')
    .select('id, name, customer_type, account_number, phone, email, city, postcode, is_active')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('name')
    .limit(limit)

  if (input.name) {
    query = query.ilike('name', `%${input.name}%`)
  }
  if (input.customer_type) {
    query = query.eq('customer_type', input.customer_type)
  }

  const { data, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) return JSON.stringify({ results: [], message: 'No customers found.' })

  return JSON.stringify({
    results: data.map((c) => {
      const dc = decryptCustomerRow(c)
      return {
        id: dc.id,
        name: dc.name,
        customer_type: dc.customer_type,
        account_number: dc.account_number,
        phone: dc.phone,
        email: dc.email,
        location: [dc.city, dc.postcode].filter(Boolean).join(', '),
        link: `/customers/${dc.id}`,
      }
    }),
    count: data.length,
  })
}

async function handleGetCustomerDetails(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { customer_id: string }
): Promise<string> {
  const [
    { data: customer, error },
    { data: contacts },
    { data: recentQuotes },
    { data: recentSOs },
    { data: dealRegs },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('id', input.customer_id)
      .eq('org_id', user.orgId)
      .single(),
    supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, job_title, is_primary')
      .eq('customer_id', input.customer_id)
      .eq('is_active', true)
      .order('is_primary', { ascending: false }),
    supabase
      .from('quotes')
      .select('id, quote_number, status, created_at, quote_lines(quantity, sell_price, is_optional)')
      .eq('customer_id', input.customer_id)
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('sales_orders')
      .select('id, so_number, customer_po, created_at, sales_order_lines(status, quantity, sell_price)')
      .eq('customer_id', input.customer_id)
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('deal_registrations')
      .select('id, supplier_name, status, start_date, end_date, deal_registration_lines(product_name, deal_cost)')
      .eq('customer_id', input.customer_id)
      .eq('org_id', user.orgId)
      .in('status', ['approved', 'pending']),
  ])

  if (error || !customer) return JSON.stringify({ error: 'Customer not found.' })

  const dc = decryptCustomerRow(customer)
  const decryptedContacts = (contacts || []).map((c: Record<string, unknown>) => decryptContactRow(c))

  return JSON.stringify({
    id: dc.id,
    name: dc.name,
    customer_type: dc.customer_type,
    account_number: dc.account_number,
    phone: dc.phone,
    email: dc.email,
    address: [dc.address_line1, dc.address_line2, dc.city, dc.county, dc.postcode].filter(Boolean).join(', '),
    website: dc.website,
    contacts: decryptedContacts.map((c: Record<string, unknown>) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
      phone: c.phone,
      job_title: c.job_title,
      is_primary: c.is_primary,
    })),
    recent_quotes: (recentQuotes || []).map((q) => {
      const qLines = (q.quote_lines || []) as { quantity: number; sell_price: number; is_optional: boolean }[]
      const firm = qLines.filter((l) => !l.is_optional)
      const value = firm.reduce((s, l) => s + l.quantity * l.sell_price, 0)
      return { id: q.id, quote_number: q.quote_number, status: q.status, value, created_at: q.created_at }
    }),
    recent_sales_orders: (recentSOs || []).map((o) => {
      const oLines = (o.sales_order_lines || []) as { status: string; quantity: number; sell_price: number }[]
      const value = oLines.reduce((s, l) => s + l.quantity * l.sell_price, 0)
      const derived = deriveSoStatus(oLines)
      return { id: o.id, so_number: o.so_number, customer_po: o.customer_po, derived_status: derived, value, created_at: o.created_at }
    }),
    deal_registrations: (dealRegs || []).map((dr) => ({
      id: dr.id,
      supplier: dr.supplier_name,
      status: dr.status,
      start_date: dr.start_date,
      end_date: dr.end_date,
      lines: (dr.deal_registration_lines || []).map((l: { product_name: string; deal_cost: number }) => ({
        product: l.product_name,
        deal_cost: l.deal_cost,
      })),
    })),
    link: `/customers/${customer.id}`,
  })
}

async function handleSearchProducts(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { query: string; limit?: number }
): Promise<string> {
  const limit = input.limit || 20
  const search = `%${input.query}%`

  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, manufacturer, default_buy_price, default_sell_price, is_active, product_categories(name), product_suppliers(supplier_id, suppliers(name), standard_cost, is_preferred)')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .or(`name.ilike.${search},sku.ilike.${search},manufacturer.ilike.${search}`)
    .order('name')
    .limit(limit)

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) return JSON.stringify({ results: [], message: 'No products found.' })

  return JSON.stringify({
    results: data.map((p) => {
      const category = p.product_categories as unknown as { name: string } | null
      const suppliers = (p.product_suppliers || []) as unknown as { supplier_id: string; suppliers: { name: string } | null; standard_cost: number; is_preferred: boolean }[]
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        manufacturer: p.manufacturer,
        category: category?.name || null,
        default_buy_price: p.default_buy_price,
        default_sell_price: p.default_sell_price,
        suppliers: suppliers.map((s) => ({
          supplier_id: s.supplier_id,
          name: s.suppliers?.name || 'Unknown',
          cost: s.standard_cost,
          is_preferred: s.is_preferred,
        })),
        link: `/products/${p.id}`,
      }
    }),
    count: data.length,
  })
}

async function handleGetDealRegistrations(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { customer_id: string }
): Promise<string> {
  const { data, error } = await supabase
    .from('v_active_deal_pricing')
    .select('*')
    .eq('customer_id', input.customer_id)

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) {
    return JSON.stringify({ results: [], message: 'No active deal registrations found for this customer.' })
  }

  return JSON.stringify({
    results: data.map((d) => ({
      deal_reg_line_id: d.deal_reg_line_id,
      product_id: d.product_id,
      product_name: d.product_name,
      supplier_name: d.supplier_name,
      deal_cost: d.deal_cost,
      catalogue_cost: d.catalogue_cost,
      saving: d.catalogue_cost && d.deal_cost ? d.catalogue_cost - d.deal_cost : null,
      deal_reg_id: d.deal_reg_id,
      expires: d.end_date,
    })),
    count: data.length,
  })
}

async function handleGetPipelineSummary(
  supabase: SupabaseInstance,
  user: AppUser,
): Promise<string> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title, stage, value, probability, expected_close_date, customers(name), users!opportunities_assigned_to_fkey(first_name, last_name)')
    .eq('org_id', user.orgId)
    .order('stage')
    .order('value', { ascending: false })

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) return JSON.stringify({ stages: [], message: 'No opportunities in the pipeline.' })

  const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
  const summary = stages.map((stage) => {
    const opps = data.filter((o) => o.stage === stage)
    const totalValue = opps.reduce((s, o) => s + (o.value || 0), 0)
    const weightedValue = opps.reduce((s, o) => s + (o.value || 0) * ((o.probability || 0) / 100), 0)
    return {
      stage,
      count: opps.length,
      total_value: totalValue,
      weighted_value: Math.round(weightedValue),
      opportunities: opps.slice(0, 5).map((o) => {
        const customer = o.customers as unknown as { name: string } | null
        const assignedUser = o.users as unknown as { first_name: string; last_name: string } | null
        return {
          id: o.id,
          title: o.title,
          customer: customer?.name || 'Unknown',
          value: o.value,
          probability: o.probability,
          expected_close: o.expected_close_date,
          assigned_to: assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : null,
        }
      }),
    }
  }).filter((s) => s.count > 0)

  const totalPipelineValue = data.reduce((s, o) => s + (o.value || 0), 0)
  const activeOpps = data.filter((o) => !['won', 'lost'].includes(o.stage))
  const activePipelineValue = activeOpps.reduce((s, o) => s + (o.value || 0), 0)

  return JSON.stringify({
    total_opportunities: data.length,
    total_pipeline_value: totalPipelineValue,
    active_pipeline_value: activePipelineValue,
    stages: summary,
  })
}

async function handleCreateDraftQuote(
  supabase: SupabaseInstance,
  user: AppUser,
  input: {
    customer_id: string
    contact_id?: string
    opportunity_id?: string
    quote_type?: string
    valid_until?: string
    customer_notes?: string
    internal_notes?: string
    groups: { name: string; lines: { product_id?: string; supplier_id?: string; deal_reg_line_id?: string; description: string; quantity: number; buy_price: number; sell_price: number; fulfilment_route?: string }[] }[]
  }
): Promise<string> {
  // Permission check
  if (!user.permissions.includes('quotes.create')) {
    return JSON.stringify({ error: 'You do not have permission to create quotes.' })
  }

  // Validate customer exists
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', input.customer_id)
    .eq('org_id', user.orgId)
    .single()

  if (custErr || !customer) {
    return JSON.stringify({ error: 'Customer not found.' })
  }

  // Validate at least one line
  const totalLines = input.groups.reduce((s, g) => s + g.lines.length, 0)
  if (totalLines === 0) {
    return JSON.stringify({ error: 'At least one line item is required.' })
  }

  // Generate quote number
  const year = new Date().getFullYear()
  const prefix = `Q-${year}-`
  const { data: existing } = await supabase
    .from('quotes')
    .select('base_quote_number')
    .eq('org_id', user.orgId)
    .like('base_quote_number', `${prefix}%`)
    .order('base_quote_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].base_quote_number
    const parts = last.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }
  const quoteNumber = `${prefix}${String(seq).padStart(4, '0')}`
  const portalToken = crypto.randomUUID()

  // Insert quote header
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .insert({
      org_id: user.orgId,
      customer_id: input.customer_id,
      contact_id: input.contact_id || null,
      opportunity_id: input.opportunity_id || null,
      assigned_to: user.id,
      quote_number: quoteNumber,
      base_quote_number: quoteNumber,
      status: 'draft',
      version: 1,
      quote_type: input.quote_type || null,
      valid_until: input.valid_until || null,
      vat_rate: 20,
      customer_notes: input.customer_notes || null,
      internal_notes: input.internal_notes || null,
      portal_token: portalToken,
    })
    .select('id')
    .single()

  if (quoteErr || !quote) {
    return JSON.stringify({ error: quoteErr?.message || 'Failed to create quote.' })
  }

  // Insert groups and map to real IDs
  const groupIdMap = new Map<number, string>()

  if (input.groups.length > 0) {
    const groupRows = input.groups.map((g, i) => ({
      quote_id: quote.id,
      name: g.name,
      sort_order: i,
    }))

    const { data: insertedGroups, error: groupsErr } = await supabase
      .from('quote_groups')
      .insert(groupRows)
      .select('id')

    if (groupsErr || !insertedGroups) {
      await supabase.from('quotes').delete().eq('id', quote.id)
      return JSON.stringify({ error: groupsErr?.message || 'Failed to create quote groups.' })
    }

    insertedGroups.forEach((g, i) => {
      groupIdMap.set(i, g.id)
    })
  }

  // Insert lines
  const lineRows: {
    quote_id: string; group_id: string | null; product_id: string | null; supplier_id: string | null;
    deal_reg_line_id: string | null; sort_order: number; description: string; quantity: number;
    buy_price: number; sell_price: number; fulfilment_route: string; is_optional: boolean; requires_contract: boolean
  }[] = []

  let lineSort = 0
  input.groups.forEach((g, gi) => {
    const groupId = groupIdMap.get(gi) || null
    g.lines.forEach((l) => {
      lineRows.push({
        quote_id: quote.id,
        group_id: groupId,
        product_id: l.product_id || null,
        supplier_id: l.supplier_id || null,
        deal_reg_line_id: l.deal_reg_line_id || null,
        sort_order: lineSort++,
        description: l.description,
        quantity: l.quantity,
        buy_price: l.buy_price,
        sell_price: l.sell_price,
        fulfilment_route: l.fulfilment_route || 'drop_ship',
        is_optional: false,
        requires_contract: false,
      })
    })
  })

  const { error: linesErr } = await supabase.from('quote_lines').insert(lineRows)
  if (linesErr) {
    await supabase.from('quotes').delete().eq('id', quote.id)
    return JSON.stringify({ error: linesErr.message })
  }

  // Default attribution: 100% direct to current user
  const { error: attrErr } = await supabase.from('quote_attributions').insert({
    quote_id: quote.id,
    user_id: user.id,
    attribution_type: 'direct',
    split_pct: 100,
  })

  if (attrErr) {
    await supabase.from('quotes').delete().eq('id', quote.id)
    return JSON.stringify({ error: attrErr.message })
  }

  // Fire-and-forget activity log
  supabase
    .from('activity_log')
    .insert({
      org_id: user.orgId,
      user_id: user.id,
      entity_type: 'quote',
      entity_id: quote.id,
      action: 'created',
      details: {
        quote_number: quoteNumber,
        customer_id: input.customer_id,
        line_count: lineRows.length,
        source: 'jasper_ai',
      },
    })
    .then(({ error: logErr }) => {
      if (logErr) console.error('[jasper] activity log error:', logErr.message)
    })

  // Calculate totals for confirmation
  const subtotal = lineRows.reduce((s, l) => s + l.quantity * l.sell_price, 0)
  const totalCost = lineRows.reduce((s, l) => s + l.quantity * l.buy_price, 0)
  const margin = subtotal > 0 ? ((subtotal - totalCost) / subtotal) * 100 : 0

  return JSON.stringify({
    success: true,
    quote_id: quote.id,
    quote_number: quoteNumber,
    customer: customer.name,
    status: 'draft',
    line_count: lineRows.length,
    subtotal,
    total_cost: totalCost,
    margin_pct: Math.round(margin * 10) / 10,
    grand_total: subtotal * 1.2,
    message: `Draft quote ${quoteNumber} created for ${customer.name}. Please review it before sending.`,
    link: `/quotes/${quote.id}`,
  })
}

// --- Tool dispatch ---

async function executeTool(
  supabase: SupabaseInstance,
  user: AppUser,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'search_quotes':
        return await handleSearchQuotes(supabase, user, toolInput as Parameters<typeof handleSearchQuotes>[2])
      case 'get_quote_details':
        return await handleGetQuoteDetails(supabase, user, toolInput as Parameters<typeof handleGetQuoteDetails>[2])
      case 'search_sales_orders':
        return await handleSearchSalesOrders(supabase, user, toolInput as Parameters<typeof handleSearchSalesOrders>[2])
      case 'get_sales_order_details':
        return await handleGetSalesOrderDetails(supabase, user, toolInput as Parameters<typeof handleGetSalesOrderDetails>[2])
      case 'search_customers':
        return await handleSearchCustomers(supabase, user, toolInput as Parameters<typeof handleSearchCustomers>[2])
      case 'get_customer_details':
        return await handleGetCustomerDetails(supabase, user, toolInput as Parameters<typeof handleGetCustomerDetails>[2])
      case 'search_products':
        return await handleSearchProducts(supabase, user, toolInput as Parameters<typeof handleSearchProducts>[2])
      case 'get_deal_registrations':
        return await handleGetDealRegistrations(supabase, user, toolInput as Parameters<typeof handleGetDealRegistrations>[2])
      case 'get_pipeline_summary':
        return await handleGetPipelineSummary(supabase, user)
      case 'create_draft_quote':
        return await handleCreateDraftQuote(supabase, user, toolInput as Parameters<typeof handleCreateDraftQuote>[2])
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    console.error(`[jasper] Tool ${toolName} error:`, err)
    return JSON.stringify({ error: `Tool execution failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
  }
}

// --- POST handler ---

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const appUser = await getAppUser(supabase)

  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
  }

  let body: { messages: { role: 'user' | 'assistant'; content: string }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'Missing messages array' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey })
    const systemPrompt = buildSystemPrompt(appUser)

    // Build conversation messages — start from the client messages
    const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Tool-calling loop
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      })

      // If the model finished naturally, extract text and return
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text')
        const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''
        return NextResponse.json({ message: { role: 'assistant', content } })
      }

      // If the model wants to call tools
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[]

        // Append the assistant response (with tool_use blocks) to conversation
        messages.push({ role: 'assistant', content: response.content })

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            const result = await executeTool(supabase, appUser, block.name, block.input as Record<string, unknown>)
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: result,
            }
          })
        )

        // Append tool results to conversation
        messages.push({ role: 'user', content: toolResults })

        // Continue the loop — Claude will process tool results
        continue
      }

      // Unexpected stop reason — extract whatever text we have
      const textBlock = response.content.find((b) => b.type === 'text')
      const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''
      return NextResponse.json({ message: { role: 'assistant', content } })
    }

    // Safety: max iterations reached
    return NextResponse.json({
      message: {
        role: 'assistant',
        content: 'I had to stop processing as the request required too many steps. Could you try a more specific question?',
      },
    })
  } catch (err) {
    console.error('Jasper agent error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
