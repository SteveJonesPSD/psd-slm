import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { deriveSoStatus } from '@/lib/sales-orders'
import { getEffectiveInvoiceStatus } from '@/lib/invoicing'

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

  return `You are Lucia, PSD Group's purchasing and administration assistant within the Innov8iv Engage platform. You help staff with sales order tracking, purchase order management, invoicing queries, stock levels, delivery tracking, and onsite scheduling.

## Your identity
- Professional, efficient, and detail-oriented. Use British English.
- Format currency as GBP (e.g. £1,234.56).
- Format times in 12-hour format (e.g. 2:30pm).
- Margin colour coding: green ≥30%, amber ≥15%, red <15%.
- SO numbers: SO-YYYY-NNNN. PO numbers: PO-YYYY-NNNN. Invoice numbers: INV-YYYY-NNNN. DN numbers: DN-YYYY-NNNN. Job numbers: JOB-YYYY-NNNN.

## Current user
- Name: ${user.firstName} ${user.lastName}
- Role: ${user.role}
- Date: ${today}

## Your capabilities
You have access to tools that query live data from the Engage database. Use them to answer questions accurately. Available operations:
- Search and view sales orders (status is always derived from line statuses)
- Search and view purchase orders with receiving progress and price variances
- Search and view invoices with overdue detection
- Check stock levels and reorder alerts
- Search delivery notes with tracking details
- Search and view jobs, check engineer availability, find nearest available engineer
- Get scheduling summaries

## Formatting
- Your responses support Markdown — use **bold**, *italic*, bullet points, numbered lists, and tables
- CRITICAL: When referencing records, ALWAYS use markdown links with the record's UUID from your tool results. The link MUST point to the detail page, not the list page. Examples:
  - Sales Order: [SO-2026-0001](/orders/{id}) — uses the SO's "id" field
  - Purchase Order: [PO-2026-0001](/purchase-orders/{id})
  - Invoice: [INV-2026-0001](/invoices/{id})
  - Delivery Note: [DN-2026-0001](/delivery-notes/{id})
  - Job: [JOB-2026-0001](/scheduling/jobs/{id})
  - Customer: [Customer Name](/customers/{id})
- In tables, ALWAYS make reference number columns a markdown link: | [SO-2026-0001](/orders/{id}) | ...
- Tables MUST have a MAXIMUM of 3 columns. Your responses are displayed in a narrow chat bubble — wide tables break the layout. Put extra detail in a summary sentence below the table, not in extra columns. Keep column content short.
- NEVER output a reference number without making it a markdown link to its detail page
- Do NOT output bare URLs — always wrap them in markdown link syntax
- Do NOT include a Margin column in tables — it causes formatting issues. Mention the overall average margin in a summary sentence below the table instead

## Rules
1. Always use your tools to look up data rather than guessing. If unsure, search first.
2. Sales order status is ALWAYS derived from line statuses — never trust a stored header status.
3. Invoice status uses effective status — a "sent" invoice past its due date is "overdue".
4. Travel time estimates are approximate — always caveat with "roughly" or "approximately".
5. Present financial data clearly — show breakdowns with quantities, prices, and margins.
6. If you don't have permission or can't find data, say so honestly.
7. Keep responses concise. Use tables or lists for structured data.
8. Highlight items below reorder point as needing attention.
9. When checking engineer availability, consider the full day context — travel time, gaps between jobs, and whether the time window is realistic.
10. PSD office location is HD5 (Huddersfield) — used as default when an engineer has no prior job that day.`
}

// --- UK Postcode Area Centroids (lat/lng) ---

const POSTCODE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  AB: { lat: 57.15, lng: -2.11 },  AL: { lat: 51.75, lng: -0.34 },
  B:  { lat: 52.48, lng: -1.89 },  BA: { lat: 51.38, lng: -2.36 },
  BB: { lat: 53.76, lng: -2.47 },  BD: { lat: 53.79, lng: -1.76 },
  BH: { lat: 50.72, lng: -1.88 },  BL: { lat: 53.58, lng: -2.43 },
  BN: { lat: 50.83, lng: -0.14 },  BR: { lat: 51.38, lng: 0.05 },
  BS: { lat: 51.45, lng: -2.59 },  BT: { lat: 54.60, lng: -5.93 },
  CA: { lat: 54.89, lng: -2.93 },  CB: { lat: 52.20, lng: 0.12 },
  CF: { lat: 51.48, lng: -3.18 },  CH: { lat: 53.19, lng: -2.89 },
  CM: { lat: 51.73, lng: 0.47 },   CO: { lat: 51.89, lng: 0.90 },
  CR: { lat: 51.37, lng: -0.10 },  CT: { lat: 51.28, lng: 1.08 },
  CV: { lat: 52.41, lng: -1.51 },  CW: { lat: 53.10, lng: -2.44 },
  DA: { lat: 51.45, lng: 0.22 },   DD: { lat: 56.46, lng: -2.97 },
  DE: { lat: 52.92, lng: -1.47 },  DG: { lat: 55.07, lng: -3.61 },
  DH: { lat: 54.78, lng: -1.57 },  DL: { lat: 54.53, lng: -1.56 },
  DN: { lat: 53.52, lng: -1.13 },  DT: { lat: 50.71, lng: -2.44 },
  DY: { lat: 52.51, lng: -2.09 },  E:  { lat: 51.55, lng: -0.06 },
  EC: { lat: 51.52, lng: -0.09 },  EH: { lat: 55.95, lng: -3.19 },
  EN: { lat: 51.65, lng: -0.08 },  EX: { lat: 50.72, lng: -3.53 },
  FK: { lat: 56.12, lng: -3.94 },  FY: { lat: 53.82, lng: -3.01 },
  G:  { lat: 55.86, lng: -4.25 },  GL: { lat: 51.86, lng: -2.24 },
  GU: { lat: 51.24, lng: -0.77 },  GY: { lat: 49.45, lng: -2.54 },
  HA: { lat: 51.58, lng: -0.34 },  HD: { lat: 53.64, lng: -1.78 },
  HG: { lat: 54.00, lng: -1.54 },  HP: { lat: 51.76, lng: -0.77 },
  HR: { lat: 52.06, lng: -2.72 },  HS: { lat: 57.76, lng: -7.02 },
  HU: { lat: 53.75, lng: -0.34 },  HX: { lat: 53.73, lng: -1.86 },
  IG: { lat: 51.56, lng: 0.08 },   IM: { lat: 54.24, lng: -4.55 },
  IP: { lat: 52.06, lng: 1.16 },   IV: { lat: 57.48, lng: -4.22 },
  JE: { lat: 49.21, lng: -2.13 },  KA: { lat: 55.46, lng: -4.63 },
  KT: { lat: 51.38, lng: -0.30 },  KW: { lat: 58.44, lng: -3.09 },
  KY: { lat: 56.21, lng: -3.15 },  L:  { lat: 53.41, lng: -2.98 },
  LA: { lat: 54.05, lng: -2.80 },  LD: { lat: 52.25, lng: -3.38 },
  LE: { lat: 52.63, lng: -1.13 },  LL: { lat: 53.12, lng: -3.83 },
  LN: { lat: 53.23, lng: -0.54 },  LS: { lat: 53.80, lng: -1.55 },
  LU: { lat: 51.88, lng: -0.42 },  M:  { lat: 53.48, lng: -2.24 },
  ME: { lat: 51.35, lng: 0.54 },   MK: { lat: 52.04, lng: -0.76 },
  ML: { lat: 55.77, lng: -3.98 },  N:  { lat: 51.57, lng: -0.10 },
  NE: { lat: 55.00, lng: -1.61 },  NG: { lat: 52.95, lng: -1.15 },
  NN: { lat: 52.23, lng: -0.89 },  NP: { lat: 51.59, lng: -3.00 },
  NR: { lat: 52.63, lng: 1.30 },   NW: { lat: 51.55, lng: -0.17 },
  OL: { lat: 53.54, lng: -2.12 },  OX: { lat: 51.75, lng: -1.26 },
  PA: { lat: 55.84, lng: -4.88 },  PE: { lat: 52.57, lng: -0.24 },
  PH: { lat: 56.69, lng: -3.43 },  PL: { lat: 50.37, lng: -4.14 },
  PO: { lat: 50.80, lng: -1.09 },  PR: { lat: 53.76, lng: -2.70 },
  RG: { lat: 51.45, lng: -1.00 },  RH: { lat: 51.12, lng: -0.19 },
  RM: { lat: 51.55, lng: 0.18 },   S:  { lat: 53.38, lng: -1.47 },
  SA: { lat: 51.62, lng: -3.94 },  SE: { lat: 51.49, lng: -0.06 },
  SG: { lat: 51.90, lng: -0.19 },  SK: { lat: 53.39, lng: -2.16 },
  SL: { lat: 51.51, lng: -0.65 },  SM: { lat: 51.37, lng: -0.17 },
  SN: { lat: 51.56, lng: -1.79 },  SO: { lat: 50.90, lng: -1.40 },
  SP: { lat: 51.07, lng: -1.80 },  SR: { lat: 54.91, lng: -1.38 },
  SS: { lat: 51.54, lng: 0.71 },   ST: { lat: 52.98, lng: -2.18 },
  SW: { lat: 51.46, lng: -0.17 },  SY: { lat: 52.71, lng: -2.75 },
  TA: { lat: 51.02, lng: -3.10 },  TD: { lat: 55.60, lng: -2.44 },
  TF: { lat: 52.68, lng: -2.49 },  TN: { lat: 51.13, lng: 0.26 },
  TQ: { lat: 50.46, lng: -3.56 },  TR: { lat: 50.26, lng: -5.05 },
  TS: { lat: 54.57, lng: -1.23 },  TW: { lat: 51.45, lng: -0.34 },
  UB: { lat: 51.53, lng: -0.42 },  W:  { lat: 51.51, lng: -0.20 },
  WA: { lat: 53.39, lng: -2.59 },  WC: { lat: 51.52, lng: -0.12 },
  WD: { lat: 51.66, lng: -0.39 },  WF: { lat: 53.68, lng: -1.49 },
  WN: { lat: 53.55, lng: -2.63 },  WR: { lat: 52.19, lng: -2.22 },
  WS: { lat: 52.58, lng: -1.97 },  WV: { lat: 52.59, lng: -2.13 },
  YO: { lat: 53.96, lng: -1.08 },  ZE: { lat: 60.39, lng: -1.15 },
}

const PSD_OFFICE_AREA = 'HD'

function extractPostcodeArea(postcode: string): string {
  const cleaned = postcode.toUpperCase().replace(/\s+/g, '')
  // Match 1-2 letters at the start
  const match = cleaned.match(/^([A-Z]{1,2})/)
  return match ? match[1] : ''
}

function haversineDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function estimateTravelTime(fromPostcode: string, toPostcode: string): { minutes: number; miles: number } | null {
  const fromArea = extractPostcodeArea(fromPostcode)
  const toArea = extractPostcodeArea(toPostcode)

  const from = POSTCODE_CENTROIDS[fromArea]
  const to = POSTCODE_CENTROIDS[toArea]

  if (!from || !to) return null

  // Same area — minimum 15 minutes
  if (fromArea === toArea) {
    return { minutes: 15, miles: 5 }
  }

  const straightLine = haversineDistanceMiles(from.lat, from.lng, to.lat, to.lng)
  const roadDistance = straightLine * 1.3 // road factor
  const minutes = Math.round((roadDistance / 30) * 60) // 30mph average
  return { minutes: Math.max(15, minutes), miles: Math.round(roadDistance) }
}

// --- Tool definitions ---

const TOOLS: Anthropic.Tool[] = [
  // Purchasing Domain (8 tools)
  {
    name: 'search_sales_orders',
    description: 'Search sales orders by customer name, SO number, status, or customer PO reference. Returns list with derived status, customer, line count, totals.',
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
    description: 'Get full details of a specific sales order including lines with status, fulfilment route, supplier, quantity received, linked POs and delivery notes, and margin per line.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sales_order_id: { type: 'string', description: 'The sales order UUID' },
      },
      required: ['sales_order_id'],
    },
  },
  {
    name: 'search_purchase_orders',
    description: 'Search purchase orders by supplier name, PO number, status, or linked SO number. Returns list with supplier, customer (via SO), totals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplier_name: { type: 'string', description: 'Filter by supplier name (partial match)' },
        po_number: { type: 'string', description: 'Filter by PO number (partial match)' },
        status: { type: 'string', description: 'Filter by status: draft, sent, acknowledged, partially_received, received, cancelled' },
        so_number: { type: 'string', description: 'Filter by linked SO number (partial match)' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_purchase_order_details',
    description: 'Get full PO details with lines, receiving progress (qty ordered vs received), price variances (PO cost vs SO buy price), and linked SO.',
    input_schema: {
      type: 'object' as const,
      properties: {
        purchase_order_id: { type: 'string', description: 'The purchase order UUID' },
      },
      required: ['purchase_order_id'],
    },
  },
  {
    name: 'search_invoices',
    description: 'Search invoices by customer name, invoice number, status, or SO number. Applies overdue detection. Returns list with effective status, due date, days overdue.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Filter by customer name (partial match)' },
        invoice_number: { type: 'string', description: 'Filter by invoice number (partial match)' },
        status: { type: 'string', description: 'Filter by effective status: draft, sent, paid, overdue, void, credit_note' },
        so_number: { type: 'string', description: 'Filter by linked SO number (partial match)' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_invoice_details',
    description: 'Get full invoice details with lines, margin per line, payment status, related invoices/credit notes, and SO link.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoice_id: { type: 'string', description: 'The invoice UUID' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'check_stock_levels',
    description: 'Check stock levels across locations. Filter by product name/SKU, or show only items below reorder point.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_query: { type: 'string', description: 'Search by product name or SKU (partial match)' },
        below_reorder_only: { type: 'boolean', description: 'If true, only return items below reorder point' },
        limit: { type: 'number', description: 'Max results to return (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'search_delivery_notes',
    description: 'Search delivery notes by DN number, status, or SO number. Returns list with carrier, tracking, dispatch/delivery dates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dn_number: { type: 'string', description: 'Filter by DN number (partial match)' },
        status: { type: 'string', description: 'Filter by status: draft, confirmed, dispatched, delivered, cancelled' },
        so_number: { type: 'string', description: 'Filter by linked SO number (partial match)' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: [],
    },
  },
  // Scheduling Domain (5 tools)
  {
    name: 'search_jobs',
    description: 'Search jobs by customer, engineer, status, date/date range, or priority. Returns list with job number, type, engineer, schedule, site postcode.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Filter by customer name (partial match)' },
        engineer_name: { type: 'string', description: 'Filter by engineer first name (partial match)' },
        status: { type: 'string', description: 'Filter by status: unscheduled, scheduled, travelling, on_site, completed, cancelled' },
        date: { type: 'string', description: 'Filter by specific date (YYYY-MM-DD)' },
        date_from: { type: 'string', description: 'Start of date range (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End of date range (YYYY-MM-DD)' },
        priority: { type: 'string', description: 'Filter by priority: low, normal, high, urgent' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_job_details',
    description: 'Get full job details with notes, parts, task checklist progress, company job history, and all timestamps.',
    input_schema: {
      type: 'object' as const,
      properties: {
        job_id: { type: 'string', description: 'The job UUID' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'check_engineer_availability',
    description: 'For a given date and optional time window, returns per-engineer: jobs today, occupied slots (start/end/customer/postcode), free slots (start/end/duration), total free minutes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date to check (YYYY-MM-DD)' },
        start_time: { type: 'string', description: 'Optional start of window (HH:MM, 24hr). Default 08:00' },
        end_time: { type: 'string', description: 'Optional end of window (HH:MM, 24hr). Default 17:00' },
      },
      required: ['date'],
    },
  },
  {
    name: 'find_nearest_available_engineer',
    description: 'Smart scheduling tool. Given a target postcode, date, time window, and estimated duration, finds available engineers ranked by travel time. Determines each engineer\'s location from last job site or PSD office, estimates travel time, and returns a ranked list with recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_postcode: { type: 'string', description: 'Postcode of the job site (e.g. "S1 2AB")' },
        date: { type: 'string', description: 'Date for the job (YYYY-MM-DD)' },
        estimated_duration_minutes: { type: 'number', description: 'How long the job is expected to take in minutes' },
        start_time: { type: 'string', description: 'Earliest start time (HH:MM, 24hr). Default 08:00' },
        end_time: { type: 'string', description: 'Latest end time (HH:MM, 24hr). Default 17:00' },
      },
      required: ['target_postcode', 'date', 'estimated_duration_minutes'],
    },
  },
  {
    name: 'get_scheduling_summary',
    description: 'Get scheduling overview for a date range: job counts by status, by engineer, unscheduled alerts, overdue jobs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['date_from', 'date_to'],
    },
  },
]

// --- Tool handlers ---

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
      assigned_to: assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : 'Unassigned',
      customer_po: o.customer_po,
      quote_number: o.quote_number,
      line_count: lines.length,
      subtotal,
      total_cost: totalCost,
      margin_pct: subtotal > 0 ? Math.round(((subtotal - totalCost) / subtotal) * 1000) / 10 : 0,
      created_at: o.created_at,
      link: `/orders/${o.id}`,
    }
  })

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
    { data: assignedUser },
    { data: lines },
    { data: pos },
    { data: dns },
  ] = await Promise.all([
    supabase.from('customers').select('id, name').eq('id', so.customer_id).single(),
    so.assigned_to
      ? supabase.from('users').select('id, first_name, last_name').eq('id', so.assigned_to).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('sales_order_lines')
      .select('*, products(id, name, sku), suppliers(id, name)')
      .eq('sales_order_id', input.sales_order_id)
      .order('group_sort', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('purchase_orders')
      .select('id, po_number, status, suppliers(name), purchase_order_lines(quantity, quantity_received, unit_cost)')
      .eq('sales_order_id', input.sales_order_id),
    supabase
      .from('delivery_notes')
      .select('id, dn_number, status, carrier, tracking_reference, dispatched_at, delivered_at')
      .eq('sales_order_id', input.sales_order_id),
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
    assigned_to: assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : null,
    customer_po: so.customer_po,
    quote_number: so.quote_number,
    created_at: so.created_at,
    delivery_address: [so.delivery_address_line1, so.delivery_address_line2, so.delivery_city, so.delivery_postcode].filter(Boolean).join(', '),
    requested_delivery_date: so.requested_delivery_date,
    notes: so.notes,
    subtotal,
    total_cost: totalCost,
    margin_pct: Math.round(margin * 10) / 10,
    lines: allLines.map((l) => ({
      id: l.id,
      description: l.description,
      product_sku: l.products?.sku || null,
      supplier: l.suppliers?.name || null,
      quantity: l.quantity,
      buy_price: l.buy_price,
      sell_price: l.sell_price,
      line_total: l.quantity * l.sell_price,
      margin_pct: l.sell_price > 0 ? Math.round(((l.sell_price - l.buy_price) / l.sell_price) * 1000) / 10 : 0,
      status: l.status,
      fulfilment_route: l.fulfilment_route,
      is_service: l.is_service,
      quantity_received: l.quantity_received,
      group_name: l.group_name,
    })),
    purchase_orders: (pos || []).map((po) => {
      const poLines = (po.purchase_order_lines || []) as { quantity: number; quantity_received: number; unit_cost: number }[]
      const totalOrdered = poLines.reduce((s, l) => s + l.quantity, 0)
      const totalReceived = poLines.reduce((s, l) => s + l.quantity_received, 0)
      const totalCostVal = poLines.reduce((s, l) => s + l.quantity * l.unit_cost, 0)
      return {
        id: po.id,
        po_number: po.po_number,
        status: po.status,
        supplier: (po.suppliers as unknown as { name: string } | null)?.name || 'Unknown',
        total_ordered: totalOrdered,
        total_received: totalReceived,
        total_cost: totalCostVal,
        link: `/purchase-orders/${po.id}`,
      }
    }),
    delivery_notes: (dns || []).map((dn) => ({
      id: dn.id,
      dn_number: dn.dn_number,
      status: dn.status,
      carrier: dn.carrier,
      tracking: dn.tracking_reference,
      dispatched_at: dn.dispatched_at,
      delivered_at: dn.delivered_at,
      link: `/delivery-notes/${dn.id}`,
    })),
    link: `/orders/${so.id}`,
  })
}

async function handleSearchPurchaseOrders(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { supplier_name?: string; po_number?: string; status?: string; so_number?: string; limit?: number }
): Promise<string> {
  const limit = input.limit || 20

  let query = supabase
    .from('purchase_orders')
    .select(`
      id, po_number, status, supplier_ref, expected_delivery_date, notes, sent_at, created_at,
      suppliers(id, name),
      sales_orders!inner(id, so_number, customer_id, customers(name)),
      purchase_order_lines(quantity, unit_cost, quantity_received)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.po_number) {
    query = query.ilike('po_number', `%${input.po_number}%`)
  }
  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data: pos, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!pos || pos.length === 0) return JSON.stringify({ results: [], message: 'No purchase orders found.' })

  let filtered = pos as (typeof pos[0])[]

  if (input.supplier_name) {
    const search = input.supplier_name.toLowerCase()
    filtered = filtered.filter((po) => {
      const supplier = po.suppliers as unknown as { name: string } | null
      return supplier?.name?.toLowerCase().includes(search)
    })
  }

  if (input.so_number) {
    const search = input.so_number.toLowerCase()
    filtered = filtered.filter((po) => {
      const so = po.sales_orders as unknown as { so_number: string } | null
      return so?.so_number?.toLowerCase().includes(search)
    })
  }

  const results = filtered.map((po) => {
    const supplier = po.suppliers as unknown as { name: string } | null
    const so = po.sales_orders as unknown as { id: string; so_number: string; customers: { name: string } | null } | null
    const poLines = (po.purchase_order_lines || []) as { quantity: number; unit_cost: number; quantity_received: number }[]
    const totalCost = poLines.reduce((s, l) => s + l.quantity * l.unit_cost, 0)
    const totalOrdered = poLines.reduce((s, l) => s + l.quantity, 0)
    const totalReceived = poLines.reduce((s, l) => s + l.quantity_received, 0)

    return {
      id: po.id,
      po_number: po.po_number,
      status: po.status,
      supplier: supplier?.name || 'Unknown',
      customer: (so?.customers as unknown as { name: string } | null)?.name || 'Unknown',
      so_number: so?.so_number || null,
      line_count: poLines.length,
      total_cost: totalCost,
      total_ordered: totalOrdered,
      total_received: totalReceived,
      expected_delivery_date: po.expected_delivery_date,
      sent_at: po.sent_at,
      created_at: po.created_at,
      link: `/purchase-orders/${po.id}`,
    }
  })

  return JSON.stringify({ results, count: results.length })
}

async function handleGetPurchaseOrderDetails(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { purchase_order_id: string }
): Promise<string> {
  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      suppliers(id, name),
      sales_orders(id, so_number, customer_id, customers(name))
    `)
    .eq('id', input.purchase_order_id)
    .eq('org_id', user.orgId)
    .single()

  if (error || !po) return JSON.stringify({ error: 'Purchase order not found.' })

  const { data: poLines } = await supabase
    .from('purchase_order_lines')
    .select(`
      id, description, quantity, unit_cost, quantity_received, status, notes, received_at,
      products(id, name, sku),
      sales_order_lines(buy_price, sell_price)
    `)
    .eq('purchase_order_id', input.purchase_order_id)
    .order('sort_order', { ascending: true })

  const allLines = (poLines || []) as unknown as {
    id: string; description: string; quantity: number; unit_cost: number;
    quantity_received: number; status: string; notes: string | null; received_at: string | null;
    products: { name: string; sku: string } | null;
    sales_order_lines: { buy_price: number; sell_price: number } | null;
  }[]

  const supplier = po.suppliers as unknown as { name: string } | null
  const so = po.sales_orders as unknown as { id: string; so_number: string; customers: { name: string } | null } | null
  const totalCost = allLines.reduce((s, l) => s + l.quantity * l.unit_cost, 0)

  return JSON.stringify({
    po_number: po.po_number,
    status: po.status,
    supplier: supplier?.name || 'Unknown',
    supplier_ref: po.supplier_ref,
    so_number: so?.so_number || null,
    customer: (so?.customers as unknown as { name: string } | null)?.name || 'Unknown',
    delivery_destination: po.delivery_destination,
    delivery_address: [po.delivery_address_line1, po.delivery_address_line2, po.delivery_city, po.delivery_postcode].filter(Boolean).join(', '),
    expected_delivery_date: po.expected_delivery_date,
    delivery_cost: po.delivery_cost,
    notes: po.notes,
    sent_at: po.sent_at,
    received_at: po.received_at,
    created_at: po.created_at,
    total_cost: totalCost,
    lines: allLines.map((l) => {
      const soLine = l.sales_order_lines as unknown as { buy_price: number; sell_price: number } | null
      const priceVariance = soLine ? l.unit_cost - soLine.buy_price : null
      return {
        description: l.description,
        product_sku: l.products?.sku || null,
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        quantity_received: l.quantity_received,
        receiving_pct: l.quantity > 0 ? Math.round((l.quantity_received / l.quantity) * 100) : 0,
        status: l.status,
        so_buy_price: soLine?.buy_price || null,
        price_variance: priceVariance,
        received_at: l.received_at,
      }
    }),
    link: `/purchase-orders/${po.id}`,
    so_link: so ? `/orders/${so.id}` : null,
  })
}

async function handleSearchInvoices(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { customer_name?: string; invoice_number?: string; status?: string; so_number?: string; limit?: number }
): Promise<string> {
  const limit = input.limit || 20

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, status, invoice_type, subtotal, vat_amount, total, due_date, paid_at, sent_at, created_at,
      customers(id, name),
      sales_orders(id, so_number),
      invoice_lines(quantity, unit_price, unit_cost)
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.invoice_number) {
    query = query.ilike('invoice_number', `%${input.invoice_number}%`)
  }

  const { data: invoices, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!invoices || invoices.length === 0) return JSON.stringify({ results: [], message: 'No invoices found.' })

  let filtered = invoices as (typeof invoices[0])[]

  if (input.customer_name) {
    const search = input.customer_name.toLowerCase()
    filtered = filtered.filter((inv) => {
      const customer = inv.customers as unknown as { name: string } | null
      return customer?.name?.toLowerCase().includes(search)
    })
  }

  if (input.so_number) {
    const search = input.so_number.toLowerCase()
    filtered = filtered.filter((inv) => {
      const so = inv.sales_orders as unknown as { so_number: string } | null
      return so?.so_number?.toLowerCase().includes(search)
    })
  }

  const results = filtered.map((inv) => {
    const customer = inv.customers as unknown as { name: string } | null
    const so = inv.sales_orders as unknown as { id: string; so_number: string } | null
    const effectiveStatus = getEffectiveInvoiceStatus(
      inv.status as Parameters<typeof getEffectiveInvoiceStatus>[0],
      inv.due_date
    )

    let daysOverdue: number | null = null
    if (effectiveStatus === 'overdue' && inv.due_date) {
      const due = new Date(inv.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    }

    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      effective_status: effectiveStatus,
      invoice_type: inv.invoice_type,
      customer: customer?.name || 'Unknown',
      so_number: so?.so_number || null,
      subtotal: inv.subtotal,
      total: inv.total,
      due_date: inv.due_date,
      days_overdue: daysOverdue,
      paid_at: inv.paid_at,
      sent_at: inv.sent_at,
      created_at: inv.created_at,
      link: `/invoices/${inv.id}`,
    }
  })

  const finalResults = input.status
    ? results.filter((r) => r.effective_status === input.status)
    : results

  return JSON.stringify({ results: finalResults, count: finalResults.length })
}

async function handleGetInvoiceDetails(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { invoice_id: string }
): Promise<string> {
  const { data: inv, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customers(id, name),
      contacts(id, first_name, last_name),
      sales_orders(id, so_number),
      brands(id, name)
    `)
    .eq('id', input.invoice_id)
    .eq('org_id', user.orgId)
    .single()

  if (error || !inv) return JSON.stringify({ error: 'Invoice not found.' })

  const [{ data: lines }, { data: related }] = await Promise.all([
    supabase
      .from('invoice_lines')
      .select('id, description, quantity, unit_price, unit_cost, vat_rate, group_name, products(name, sku)')
      .eq('invoice_id', input.invoice_id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('invoices')
      .select('id, invoice_number, invoice_type, status, total')
      .eq('org_id', user.orgId)
      .or(`parent_invoice_id.eq.${input.invoice_id},id.eq.${inv.parent_invoice_id || '00000000-0000-0000-0000-000000000000'}`),
  ])

  const customer = inv.customers as unknown as { name: string } | null
  const contact = inv.contacts as unknown as { first_name: string; last_name: string } | null
  const so = inv.sales_orders as unknown as { id: string; so_number: string } | null
  const brand = inv.brands as unknown as { name: string } | null

  const effectiveStatus = getEffectiveInvoiceStatus(
    inv.status as Parameters<typeof getEffectiveInvoiceStatus>[0],
    inv.due_date
  )

  const allLines = (lines || []) as unknown as {
    id: string; description: string; quantity: number; unit_price: number;
    unit_cost: number; vat_rate: number; group_name: string | null;
    products: { name: string; sku: string } | null;
  }[]

  return JSON.stringify({
    invoice_number: inv.invoice_number,
    effective_status: effectiveStatus,
    invoice_type: inv.invoice_type,
    customer: customer?.name || 'Unknown',
    contact: contact ? `${contact.first_name} ${contact.last_name}` : null,
    brand: brand?.name || null,
    so_number: so?.so_number || null,
    customer_po: inv.customer_po,
    payment_terms: inv.payment_terms,
    due_date: inv.due_date,
    sent_at: inv.sent_at,
    paid_at: inv.paid_at,
    subtotal: inv.subtotal,
    vat_amount: inv.vat_amount,
    vat_rate: inv.vat_rate,
    total: inv.total,
    notes: inv.notes,
    internal_notes: inv.internal_notes,
    created_at: inv.created_at,
    lines: allLines.map((l) => {
      const lineTotal = l.quantity * l.unit_price
      const lineCost = l.quantity * l.unit_cost
      const marginPct = lineTotal > 0 ? ((lineTotal - lineCost) / lineTotal) * 100 : 0
      return {
        description: l.description,
        product_sku: l.products?.sku || null,
        quantity: l.quantity,
        unit_price: l.unit_price,
        unit_cost: l.unit_cost,
        line_total: lineTotal,
        margin_pct: Math.round(marginPct * 10) / 10,
        group_name: l.group_name,
      }
    }),
    related_invoices: (related || [])
      .filter((r) => r.id !== input.invoice_id)
      .map((r) => ({
        id: r.id,
        invoice_number: r.invoice_number,
        invoice_type: r.invoice_type,
        status: r.status,
        total: r.total,
        link: `/invoices/${r.id}`,
      })),
    link: `/invoices/${inv.id}`,
    so_link: so ? `/orders/${so.id}` : null,
  })
}

async function handleCheckStockLevels(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { product_query?: string; below_reorder_only?: boolean; limit?: number }
): Promise<string> {
  const limit = input.limit || 50

  let query = supabase
    .from('v_stock_availability')
    .select('*')
    .eq('org_id', user.orgId)
    .order('product_name')
    .limit(limit)

  if (input.below_reorder_only) {
    query = query.eq('below_reorder', true)
  }

  const { data, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) {
    return JSON.stringify({
      results: [],
      message: input.below_reorder_only
        ? 'No items below reorder point — stock levels are healthy.'
        : 'No stock records found.',
    })
  }

  let filtered = data
  if (input.product_query) {
    const search = input.product_query.toLowerCase()
    filtered = data.filter((s) =>
      s.product_name?.toLowerCase().includes(search) ||
      s.sku?.toLowerCase().includes(search)
    )
  }

  const results = filtered.map((s) => ({
    product_name: s.product_name,
    sku: s.sku,
    category: s.category_name,
    location: s.location_name,
    location_code: s.location_code,
    quantity_on_hand: s.quantity_on_hand,
    quantity_allocated: s.quantity_allocated,
    quantity_available: s.quantity_available,
    reorder_point: s.reorder_point,
    below_reorder: s.below_reorder,
  }))

  const belowCount = results.filter((r) => r.below_reorder).length

  return JSON.stringify({
    results,
    count: results.length,
    below_reorder_count: belowCount,
    message: belowCount > 0 ? `${belowCount} item(s) below reorder point.` : null,
  })
}

async function handleSearchDeliveryNotes(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { dn_number?: string; status?: string; so_number?: string; limit?: number }
): Promise<string> {
  const limit = input.limit || 20

  let query = supabase
    .from('delivery_notes')
    .select(`
      id, dn_number, status, carrier, tracking_reference, notes,
      delivery_postcode, confirmed_at, dispatched_at, delivered_at, created_at,
      sales_orders(id, so_number, customer_id, customers(name))
    `)
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.dn_number) {
    query = query.ilike('dn_number', `%${input.dn_number}%`)
  }
  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data: dns, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!dns || dns.length === 0) return JSON.stringify({ results: [], message: 'No delivery notes found.' })

  let filtered = dns as (typeof dns[0])[]

  if (input.so_number) {
    const search = input.so_number.toLowerCase()
    filtered = filtered.filter((dn) => {
      const so = dn.sales_orders as unknown as { so_number: string } | null
      return so?.so_number?.toLowerCase().includes(search)
    })
  }

  const results = filtered.map((dn) => {
    const so = dn.sales_orders as unknown as { id: string; so_number: string; customers: { name: string } | null } | null
    return {
      id: dn.id,
      dn_number: dn.dn_number,
      status: dn.status,
      so_number: so?.so_number || null,
      customer: (so?.customers as unknown as { name: string } | null)?.name || 'Unknown',
      carrier: dn.carrier,
      tracking: dn.tracking_reference,
      delivery_postcode: dn.delivery_postcode,
      confirmed_at: dn.confirmed_at,
      dispatched_at: dn.dispatched_at,
      delivered_at: dn.delivered_at,
      created_at: dn.created_at,
      link: `/delivery-notes/${dn.id}`,
    }
  })

  return JSON.stringify({ results, count: results.length })
}

async function handleSearchJobs(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { customer_name?: string; engineer_name?: string; status?: string; date?: string; date_from?: string; date_to?: string; priority?: string; limit?: number }
): Promise<string> {
  const limit = input.limit || 20

  let query = supabase
    .from('jobs')
    .select(`
      id, job_number, title, status, priority, scheduled_date, scheduled_time,
      estimated_duration_minutes, site_postcode, completed_at, created_at,
      customers!jobs_company_id_fkey(id, name),
      users!jobs_assigned_to_fkey(id, first_name, last_name),
      job_types(name, color)
    `)
    .eq('org_id', user.orgId)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: true })
    .limit(limit)

  if (input.status) {
    query = query.eq('status', input.status)
  }
  if (input.priority) {
    query = query.eq('priority', input.priority)
  }
  if (input.date) {
    query = query.eq('scheduled_date', input.date)
  } else {
    if (input.date_from) {
      query = query.gte('scheduled_date', input.date_from)
    }
    if (input.date_to) {
      query = query.lte('scheduled_date', input.date_to)
    }
  }

  const { data: jobs, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!jobs || jobs.length === 0) return JSON.stringify({ results: [], message: 'No jobs found.' })

  let filtered = jobs as (typeof jobs[0])[]

  if (input.customer_name) {
    const search = input.customer_name.toLowerCase()
    filtered = filtered.filter((j) => {
      const customer = j.customers as unknown as { name: string } | null
      return customer?.name?.toLowerCase().includes(search)
    })
  }

  if (input.engineer_name) {
    const search = input.engineer_name.toLowerCase()
    filtered = filtered.filter((j) => {
      const eng = j.users as unknown as { first_name: string; last_name: string } | null
      return eng?.first_name?.toLowerCase().includes(search) || eng?.last_name?.toLowerCase().includes(search)
    })
  }

  const results = filtered.map((j) => {
    const customer = j.customers as unknown as { name: string } | null
    const engineer = j.users as unknown as { first_name: string; last_name: string } | null
    const jobType = j.job_types as unknown as { name: string; color: string } | null
    return {
      id: j.id,
      job_number: j.job_number,
      title: j.title,
      status: j.status,
      priority: j.priority,
      job_type: jobType?.name || null,
      customer: customer?.name || 'Unknown',
      engineer: engineer ? `${engineer.first_name} ${engineer.last_name}` : 'Unassigned',
      scheduled_date: j.scheduled_date,
      scheduled_time: j.scheduled_time,
      duration_minutes: j.estimated_duration_minutes,
      site_postcode: j.site_postcode,
      completed_at: j.completed_at,
      link: `/scheduling/jobs/${j.id}`,
    }
  })

  return JSON.stringify({ results, count: results.length })
}

async function handleGetJobDetails(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { job_id: string }
): Promise<string> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      customers!jobs_company_id_fkey(id, name),
      users!jobs_assigned_to_fkey(id, first_name, last_name),
      job_types(name, color)
    `)
    .eq('id', input.job_id)
    .eq('org_id', user.orgId)
    .single()

  if (error || !job) return JSON.stringify({ error: 'Job not found.' })

  const [{ data: notes }, { data: parts }, { data: tasks }, { data: companyHistory }] = await Promise.all([
    supabase
      .from('job_notes')
      .select('id, note, is_internal, created_at, users(first_name, last_name)')
      .eq('job_id', input.job_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('job_parts')
      .select('id, description, quantity, unit_cost')
      .eq('job_id', input.job_id),
    supabase
      .from('job_tasks')
      .select('id, description, response_type, is_required, is_completed, response_value, completed_at')
      .eq('job_id', input.job_id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('jobs')
      .select('id, job_number, title, status, scheduled_date')
      .eq('company_id', job.company_id)
      .eq('org_id', user.orgId)
      .neq('id', input.job_id)
      .order('scheduled_date', { ascending: false })
      .limit(5),
  ])

  const customer = job.customers as unknown as { name: string } | null
  const engineer = job.users as unknown as { first_name: string; last_name: string } | null
  const jobType = job.job_types as unknown as { name: string } | null

  const allTasks = (tasks || []) as { id: string; description: string; response_type: string; is_required: boolean; is_completed: boolean; response_value: string | null; completed_at: string | null }[]
  const completedTasks = allTasks.filter((t) => t.is_completed).length

  return JSON.stringify({
    job_number: job.job_number,
    title: job.title,
    description: job.description,
    status: job.status,
    priority: job.priority,
    job_type: jobType?.name || null,
    customer: customer?.name || 'Unknown',
    engineer: engineer ? `${engineer.first_name} ${engineer.last_name}` : 'Unassigned',
    site_address: [job.site_address_line1, job.site_address_line2, job.site_city, job.site_county, job.site_postcode].filter(Boolean).join(', '),
    site_postcode: job.site_postcode,
    scheduled_date: job.scheduled_date,
    scheduled_time: job.scheduled_time,
    duration_minutes: job.estimated_duration_minutes,
    travel_started_at: job.travel_started_at,
    arrived_at: job.arrived_at,
    completed_at: job.completed_at,
    completion_notes: job.completion_notes,
    follow_up_required: job.follow_up_required,
    validated_at: job.validated_at,
    validation_notes: job.validation_notes,
    internal_notes: job.internal_notes,
    task_progress: allTasks.length > 0
      ? { completed: completedTasks, total: allTasks.length, pct: Math.round((completedTasks / allTasks.length) * 100) }
      : null,
    tasks: allTasks.map((t) => ({
      description: t.description,
      response_type: t.response_type,
      is_required: t.is_required,
      is_completed: t.is_completed,
      response_value: t.response_value,
    })),
    notes: (notes || []).map((n) => {
      const noteUser = n.users as unknown as { first_name: string; last_name: string } | null
      return {
        note: n.note,
        is_internal: n.is_internal,
        by: noteUser ? `${noteUser.first_name} ${noteUser.last_name}` : 'System',
        at: n.created_at,
      }
    }),
    parts: (parts || []).map((p) => ({
      description: p.description,
      quantity: p.quantity,
      unit_cost: p.unit_cost,
      total: p.quantity * p.unit_cost,
    })),
    company_history: (companyHistory || []).map((h) => ({
      id: h.id,
      job_number: h.job_number,
      title: h.title,
      status: h.status,
      scheduled_date: h.scheduled_date,
      link: `/scheduling/jobs/${h.id}`,
    })),
    link: `/scheduling/jobs/${job.id}`,
  })
}

async function getEngineers(supabase: SupabaseInstance, orgId: string) {
  // Get engineers from Infrastructure/Engineering teams
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('user_id, teams!inner(slug)')
    .in('teams.slug', ['infrastructure', 'engineering'])

  if (teamMembers && teamMembers.length > 0) {
    const userIds = [...new Set(teamMembers.map((tm) => tm.user_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', userIds)
      .eq('is_active', true)

    return users || []
  }

  // Fallback: all active users
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .eq('is_active', true)

  return users || []
}

async function handleCheckEngineerAvailability(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { date: string; start_time?: string; end_time?: string }
): Promise<string> {
  const startTime = input.start_time || '08:00'
  const endTime = input.end_time || '17:00'

  const engineers = await getEngineers(supabase, user.orgId)
  if (engineers.length === 0) return JSON.stringify({ error: 'No engineers found.' })

  const engineerIds = engineers.map((e) => e.id)

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number, title, assigned_to, scheduled_time, estimated_duration_minutes, site_postcode, status, customers!jobs_company_id_fkey(name)')
    .eq('org_id', user.orgId)
    .eq('scheduled_date', input.date)
    .in('assigned_to', engineerIds)
    .not('status', 'eq', 'cancelled')
    .order('scheduled_time', { ascending: true })

  const dayStart = parseTimeToMinutes(startTime)
  const dayEnd = parseTimeToMinutes(endTime)

  const availability = engineers.map((eng) => {
    const engJobs = (jobs || []).filter((j) => j.assigned_to === eng.id)

    const occupied = engJobs.map((j) => {
      const start = parseTimeToMinutes(j.scheduled_time || '09:00')
      const duration = j.estimated_duration_minutes || 60
      const customer = j.customers as unknown as { name: string } | null
      return {
        job_number: j.job_number,
        start: minutesToTime(start),
        end: minutesToTime(start + duration),
        duration,
        customer: customer?.name || 'Unknown',
        postcode: j.site_postcode,
        status: j.status,
      }
    })

    // Calculate free slots
    const freeSlots: { start: string; end: string; duration: number }[] = []
    let cursor = dayStart

    for (const slot of occupied) {
      const slotStart = parseTimeToMinutes(slot.start)
      if (slotStart > cursor) {
        freeSlots.push({
          start: minutesToTime(cursor),
          end: minutesToTime(slotStart),
          duration: slotStart - cursor,
        })
      }
      const slotEnd = parseTimeToMinutes(slot.end)
      cursor = Math.max(cursor, slotEnd)
    }

    if (cursor < dayEnd) {
      freeSlots.push({
        start: minutesToTime(cursor),
        end: minutesToTime(dayEnd),
        duration: dayEnd - cursor,
      })
    }

    const totalFreeMinutes = freeSlots.reduce((s, f) => s + f.duration, 0)

    return {
      engineer: `${eng.first_name} ${eng.last_name}`,
      engineer_id: eng.id,
      job_count: engJobs.length,
      occupied_slots: occupied,
      free_slots: freeSlots,
      total_free_minutes: totalFreeMinutes,
    }
  })

  return JSON.stringify({
    date: input.date,
    window: `${startTime} - ${endTime}`,
    engineers: availability,
  })
}

async function handleFindNearestAvailableEngineer(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { target_postcode: string; date: string; estimated_duration_minutes: number; start_time?: string; end_time?: string }
): Promise<string> {
  const startTime = input.start_time || '08:00'
  const endTime = input.end_time || '17:00'
  const duration = input.estimated_duration_minutes

  const engineers = await getEngineers(supabase, user.orgId)
  if (engineers.length === 0) return JSON.stringify({ error: 'No engineers found.' })

  const engineerIds = engineers.map((e) => e.id)

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, assigned_to, scheduled_time, estimated_duration_minutes, site_postcode, status, customers!jobs_company_id_fkey(name)')
    .eq('org_id', user.orgId)
    .eq('scheduled_date', input.date)
    .in('assigned_to', engineerIds)
    .not('status', 'eq', 'cancelled')
    .order('scheduled_time', { ascending: true })

  const dayStart = parseTimeToMinutes(startTime)
  const dayEnd = parseTimeToMinutes(endTime)

  const candidates: {
    engineer: string
    engineer_id: string
    travel_from: string
    travel_minutes: number | null
    travel_miles: number | null
    earliest_arrival: string
    available_until: string | null
    buffer_minutes: number | null
    tightness: string
    notes: string
  }[] = []

  for (const eng of engineers) {
    const engJobs = (jobs || []).filter((j) => j.assigned_to === eng.id)

    // Build occupied intervals
    const intervals = engJobs.map((j) => {
      const start = parseTimeToMinutes(j.scheduled_time || '09:00')
      const dur = j.estimated_duration_minutes || 60
      return { start, end: start + dur, postcode: j.site_postcode }
    }).sort((a, b) => a.start - b.start)

    // Find free slots that could fit the job
    const freeSlots: { start: number; end: number; prevPostcode: string | null }[] = []
    let cursor = dayStart
    let lastPostcode: string | null = null

    for (const interval of intervals) {
      if (interval.start > cursor) {
        freeSlots.push({ start: cursor, end: interval.start, prevPostcode: lastPostcode })
      }
      cursor = Math.max(cursor, interval.end)
      lastPostcode = interval.postcode
    }
    if (cursor < dayEnd) {
      freeSlots.push({ start: cursor, end: dayEnd, prevPostcode: lastPostcode })
    }

    // Check each free slot for feasibility
    for (const slot of freeSlots) {
      const fromPostcode = slot.prevPostcode || 'HD5'
      const travel = estimateTravelTime(fromPostcode, input.target_postcode)
      const travelMinutes = travel?.minutes || 30

      const arrivalTime = slot.start + travelMinutes
      const jobEnd = arrivalTime + duration

      // Can the job fit in this slot?
      if (arrivalTime >= dayStart && jobEnd <= slot.end && arrivalTime < dayEnd) {
        const bufferMinutes = slot.end - jobEnd
        let tightness = 'comfortable'
        if (bufferMinutes < 15) tightness = 'no_gap'
        else if (bufferMinutes < 30) tightness = 'tight'

        const notes: string[] = []
        if (!travel) notes.push('Travel estimate unavailable — unknown postcode area.')
        if (tightness === 'tight') notes.push('Tight schedule — limited buffer before next commitment.')
        if (tightness === 'no_gap') notes.push('No gap after this job — runs right up to next commitment.')
        if (slot.prevPostcode === null) notes.push('Starting from PSD office (HD5).')

        candidates.push({
          engineer: `${eng.first_name} ${eng.last_name}`,
          engineer_id: eng.id,
          travel_from: fromPostcode,
          travel_minutes: travel?.minutes || null,
          travel_miles: travel?.miles || null,
          earliest_arrival: minutesToTime(arrivalTime),
          available_until: minutesToTime(slot.end),
          buffer_minutes: bufferMinutes,
          tightness,
          notes: notes.join(' ') || 'Good availability.',
        })
        break // Only take the first viable slot per engineer
      }
    }
  }

  // Sort by travel time (nulls last)
  candidates.sort((a, b) => {
    if (a.travel_minutes === null) return 1
    if (b.travel_minutes === null) return -1
    return a.travel_minutes - b.travel_minutes
  })

  // Add recommendation
  const ranked = candidates.map((c, i) => ({
    rank: i + 1,
    ...c,
    recommendation: i === 0 ? 'Best option — shortest travel time.' : undefined,
  }))

  return JSON.stringify({
    target_postcode: input.target_postcode,
    date: input.date,
    required_duration: duration,
    window: `${startTime} - ${endTime}`,
    candidates: ranked,
    count: ranked.length,
    message: ranked.length === 0
      ? 'No engineers available for this time slot and duration. Consider a different date or time window.'
      : `Found ${ranked.length} available engineer(s).`,
  })
}

async function handleGetSchedulingSummary(
  supabase: SupabaseInstance,
  user: AppUser,
  input: { date_from: string; date_to: string }
): Promise<string> {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      id, job_number, title, status, priority, scheduled_date,
      assigned_to, completed_at,
      users!jobs_assigned_to_fkey(first_name, last_name)
    `)
    .eq('org_id', user.orgId)
    .gte('scheduled_date', input.date_from)
    .lte('scheduled_date', input.date_to)

  if (error) return JSON.stringify({ error: error.message })
  if (!jobs || jobs.length === 0) {
    return JSON.stringify({ message: 'No jobs found in this date range.', total: 0 })
  }

  const allJobs = jobs as (typeof jobs[0])[]

  // By status
  const statusCounts: Record<string, number> = {}
  allJobs.forEach((j) => {
    statusCounts[j.status] = (statusCounts[j.status] || 0) + 1
  })

  // By engineer
  const engineerCounts: Record<string, { name: string; total: number; completed: number }> = {}
  allJobs.forEach((j) => {
    const eng = j.users as unknown as { first_name: string; last_name: string } | null
    const name = eng ? `${eng.first_name} ${eng.last_name}` : 'Unassigned'
    if (!engineerCounts[name]) engineerCounts[name] = { name, total: 0, completed: 0 }
    engineerCounts[name].total++
    if (j.status === 'completed') engineerCounts[name].completed++
  })

  // Unscheduled
  const unscheduled = allJobs.filter((j) => j.status === 'unscheduled')

  // Overdue (scheduled date passed, not completed/cancelled)
  const today = new Date().toISOString().split('T')[0]
  const overdue = allJobs.filter((j) =>
    j.scheduled_date < today &&
    !['completed', 'cancelled'].includes(j.status)
  )

  return JSON.stringify({
    date_range: `${input.date_from} to ${input.date_to}`,
    total_jobs: allJobs.length,
    by_status: statusCounts,
    by_engineer: Object.values(engineerCounts),
    unscheduled_count: unscheduled.length,
    unscheduled: unscheduled.map((j) => ({
      job_number: j.job_number,
      title: j.title,
      priority: j.priority,
      link: `/scheduling/jobs/${j.id}`,
    })),
    overdue_count: overdue.length,
    overdue: overdue.map((j) => ({
      job_number: j.job_number,
      title: j.title,
      scheduled_date: j.scheduled_date,
      status: j.status,
      link: `/scheduling/jobs/${j.id}`,
    })),
  })
}

// --- Time helpers ---

function parseTimeToMinutes(time: string): number {
  const parts = time.split(':')
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10)
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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
      case 'search_sales_orders':
        return await handleSearchSalesOrders(supabase, user, toolInput as Parameters<typeof handleSearchSalesOrders>[2])
      case 'get_sales_order_details':
        return await handleGetSalesOrderDetails(supabase, user, toolInput as Parameters<typeof handleGetSalesOrderDetails>[2])
      case 'search_purchase_orders':
        return await handleSearchPurchaseOrders(supabase, user, toolInput as Parameters<typeof handleSearchPurchaseOrders>[2])
      case 'get_purchase_order_details':
        return await handleGetPurchaseOrderDetails(supabase, user, toolInput as Parameters<typeof handleGetPurchaseOrderDetails>[2])
      case 'search_invoices':
        return await handleSearchInvoices(supabase, user, toolInput as Parameters<typeof handleSearchInvoices>[2])
      case 'get_invoice_details':
        return await handleGetInvoiceDetails(supabase, user, toolInput as Parameters<typeof handleGetInvoiceDetails>[2])
      case 'check_stock_levels':
        return await handleCheckStockLevels(supabase, user, toolInput as Parameters<typeof handleCheckStockLevels>[2])
      case 'search_delivery_notes':
        return await handleSearchDeliveryNotes(supabase, user, toolInput as Parameters<typeof handleSearchDeliveryNotes>[2])
      case 'search_jobs':
        return await handleSearchJobs(supabase, user, toolInput as Parameters<typeof handleSearchJobs>[2])
      case 'get_job_details':
        return await handleGetJobDetails(supabase, user, toolInput as Parameters<typeof handleGetJobDetails>[2])
      case 'check_engineer_availability':
        return await handleCheckEngineerAvailability(supabase, user, toolInput as Parameters<typeof handleCheckEngineerAvailability>[2])
      case 'find_nearest_available_engineer':
        return await handleFindNearestAvailableEngineer(supabase, user, toolInput as Parameters<typeof handleFindNearestAvailableEngineer>[2])
      case 'get_scheduling_summary':
        return await handleGetSchedulingSummary(supabase, user, toolInput as Parameters<typeof handleGetSchedulingSummary>[2])
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    console.error(`[lucia] Tool ${toolName} error:`, err)
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

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text')
        const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''
        return NextResponse.json({ message: { role: 'assistant', content } })
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[]

        messages.push({ role: 'assistant', content: response.content })

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

        messages.push({ role: 'user', content: toolResults })
        continue
      }

      const textBlock = response.content.find((b) => b.type === 'text')
      const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''
      return NextResponse.json({ message: { role: 'assistant', content } })
    }

    return NextResponse.json({
      message: {
        role: 'assistant',
        content: 'I had to stop processing as the request required too many steps. Could you try a more specific question?',
      },
    })
  } catch (err) {
    console.error('Lucia agent error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
