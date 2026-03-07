// =============================================================================
// AI Scenario Engine — Read-Only Tools
// Shared tool definitions and handlers for the scenario engine.
// All tools are READ-ONLY lookups scoped to org_id. No creates/updates/deletes.
// =============================================================================

import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveInvoiceStatus } from '@/lib/invoicing'
import { deriveSoStatus } from '@/lib/sales-orders'

type AdminClient = ReturnType<typeof createAdminClient>

interface ToolContext {
  orgId: string
  customerName: string | null
  contactName: string | null
  contactEmail: string | null
}

// =============================================================================
// Tool definitions (Anthropic format)
// =============================================================================

export const SCENARIO_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_invoices',
    description: 'Search invoices by customer name, invoice number, or status. Applies overdue detection. Returns list with effective status, amounts, due date, days overdue.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Filter by customer name (partial match)' },
        invoice_number: { type: 'string', description: 'Filter by invoice number (partial match)' },
        status: { type: 'string', description: 'Filter by effective status: draft, sent, paid, overdue, void, credit_note' },
        limit: { type: 'number', description: 'Max results to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_invoice_details',
    description: 'Get full invoice details with line items, payment status, and amounts. Use after search_invoices to get details for a specific invoice.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoice_id: { type: 'string', description: 'The invoice UUID' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'search_contracts',
    description: 'Search customer contracts (service desk SLA and visit scheduling). Returns contract type, status, SLA plan, and visit schedule info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Filter by customer name (partial match)' },
        status: { type: 'string', description: 'Filter by status: draft, active, expired, cancelled' },
        limit: { type: 'number', description: 'Max results to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_contract_details',
    description: 'Get full contract details including contract type, SLA plan, support entitlements, visit slots, and renewal info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_id: { type: 'string', description: 'The contract UUID' },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'search_quotes',
    description: 'Search quotes by customer name, quote number, or status. Returns list with totals and status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Filter by customer name (partial match)' },
        quote_number: { type: 'string', description: 'Filter by quote number (partial match)' },
        status: { type: 'string', description: 'Filter by status: draft, sent, accepted, declined, expired, revised' },
        limit: { type: 'number', description: 'Max results to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_quote_details',
    description: 'Get full quote details with line items, groups, and totals.',
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
        limit: { type: 'number', description: 'Max results to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_sales_order_details',
    description: 'Get full sales order details with lines, delivery status, and linked POs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sales_order_id: { type: 'string', description: 'The sales order UUID' },
      },
      required: ['sales_order_id'],
    },
  },
  {
    name: 'search_tickets',
    description: 'Search helpdesk tickets by customer name, ticket number, status, or priority.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Filter by customer name (partial match)' },
        ticket_number: { type: 'string', description: 'Filter by ticket number (partial match)' },
        status: { type: 'string', description: 'Filter by status: new, open, in_progress, waiting_on_customer, on_hold, resolved, closed, cancelled' },
        limit: { type: 'number', description: 'Max results to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_customer_details',
    description: 'Get customer details including contacts, active contracts, and recent activity summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: { type: 'string', description: 'The customer UUID' },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'search_customers',
    description: 'Search customers by name. Returns list with basic details.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Filter by customer name (partial match)' },
        limit: { type: 'number', description: 'Max results to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'find_customer_by_email',
    description: 'Find the customer account associated with an email address. Searches contacts by email domain (e.g. "acme.com" from "jane@acme.com") and also checks the customer_email_domains table. This is the best first step when you know the sender\'s email but not their company name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', description: 'The full email address to look up (e.g. "jane@acme.com")' },
      },
      required: ['email'],
    },
  },
  {
    name: 'generate_portal_link',
    description: 'Generate a magic login link for the customer portal. The customer can click this link to access their portal dashboard where they can view invoices, quotes, orders, contracts, and tickets. The link expires in 15 minutes. Only works if the contact has portal access enabled.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_email: { type: 'string', description: 'The contact email address to generate a portal link for' },
      },
      required: ['contact_email'],
    },
  },
]

// =============================================================================
// Tool dispatcher
// =============================================================================

export async function executeScenarioTool(
  supabase: AdminClient,
  ctx: ToolContext,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'search_invoices':
        return await handleSearchInvoices(supabase, ctx, toolInput as { customer_name?: string; invoice_number?: string; status?: string; limit?: number })
      case 'get_invoice_details':
        return await handleGetInvoiceDetails(supabase, ctx, toolInput as { invoice_id: string })
      case 'search_contracts':
        return await handleSearchContracts(supabase, ctx, toolInput as { customer_name?: string; status?: string; limit?: number })
      case 'get_contract_details':
        return await handleGetContractDetails(supabase, ctx, toolInput as { contract_id: string })
      case 'search_quotes':
        return await handleSearchQuotes(supabase, ctx, toolInput as { customer_name?: string; quote_number?: string; status?: string; limit?: number })
      case 'get_quote_details':
        return await handleGetQuoteDetails(supabase, ctx, toolInput as { quote_id: string })
      case 'search_sales_orders':
        return await handleSearchSalesOrders(supabase, ctx, toolInput as { customer_name?: string; so_number?: string; status?: string; limit?: number })
      case 'get_sales_order_details':
        return await handleGetSalesOrderDetails(supabase, ctx, toolInput as { sales_order_id: string })
      case 'search_tickets':
        return await handleSearchTickets(supabase, ctx, toolInput as { customer_name?: string; ticket_number?: string; status?: string; limit?: number })
      case 'get_customer_details':
        return await handleGetCustomerDetails(supabase, ctx, toolInput as { customer_id: string })
      case 'search_customers':
        return await handleSearchCustomers(supabase, ctx, toolInput as { name?: string; limit?: number })
      case 'find_customer_by_email':
        return await handleFindCustomerByEmail(supabase, ctx, toolInput as { email: string })
      case 'generate_portal_link':
        return await handleGeneratePortalLink(supabase, ctx, toolInput as { contact_email: string })
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    console.error(`[ScenarioEngine] Tool ${toolName} error:`, err)
    return JSON.stringify({ error: `Tool execution failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
  }
}

// =============================================================================
// Shared system prompt builder
// =============================================================================

export function buildActionSystemPrompt(agentId: string, actionPrompt: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const portalUrl = siteUrl ? `${siteUrl}/portal` : ''

  return `You are an AI agent (${agentId}) responding to an inbound email on behalf of PSD Group.
You have access to read-only tools that can look up real data: invoices, contracts, quotes, sales orders, tickets, and customer details. USE THESE TOOLS to find actual data before composing your reply.

CRITICAL RULES:
- This is a single automated response. There is NO opportunity for back-and-forth conversation.
- NEVER ask the sender to confirm details that are already available in the email, sender info, or customer context.
- Use the sender name, email address, customer name, and any details in the email body as established facts.
- Your reply must be complete and self-contained — include all relevant information in one response.
- Be direct and helpful. Get straight to the point.
- ALWAYS use your tools to look up real data. NEVER fabricate invoice numbers, amounts, dates, or other specifics.
- If a tool returns no results or an error, say so honestly — do not invent data.
- NEVER claim to attach files — you cannot send attachments. Instead, reference the data inline or direct the customer to the portal.${portalUrl ? `\n- Customer portal URL: ${portalUrl} — direct customers here to view invoices, quotes, orders, contracts, and tickets online.` : ''}
- Format currency as GBP (e.g. £1,234.56). Use British English.
- Do NOT expose internal fields like margin, cost price, or internal notes.
- Be efficient with tool calls. Call multiple tools in parallel where possible. Aim to complete all lookups within 2-3 rounds.
- IMPORTANT: Your first tool call should almost always be find_customer_by_email using the sender's email address. This resolves the sender to a customer account. Then use the customer_id from that result for subsequent lookups (search_invoices, search_contracts, etc.).
- When linking to the customer portal, use generate_portal_link to create a magic login link. NEVER use a raw portal URL — always generate a magic link so the customer is authenticated automatically.
- ALWAYS sign off emails as ${agentId.charAt(0).toUpperCase() + agentId.slice(1)} from PSD Group. Example sign-off: "Best regards,<br>${agentId.charAt(0).toUpperCase() + agentId.slice(1)}<br>PSD Group". NEVER use "Customer Service", "Customer Services", or any generic team name in the sign-off.

ACTION INSTRUCTIONS:
${actionPrompt}

After using tools and gathering data, return a JSON object with this structure:
{
  "subject": "Re: <original subject or a new subject>",
  "body_html": "<html formatted email reply body>",
  "actions_taken": ["description of action 1", "description of action 2"],
  "summary": "brief summary of what was done"
}

Return ONLY the JSON object as your final response, nothing else.`
}

// =============================================================================
// Tool-calling loop (shared between live engine and test sender)
// =============================================================================

const MAX_TOOL_ITERATIONS = 10

export async function runToolCallingLoop(params: {
  anthropic: Anthropic
  supabase: AdminClient
  systemPrompt: string
  userMessage: string
  ctx: ToolContext
}): Promise<{ subject: string | null; body_html: string | null; actions_taken: Record<string, unknown>[] }> {
  const { anthropic, supabase, systemPrompt, userMessage, ctx } = params

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ]

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      tools: SCENARIO_TOOLS,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      return parseActionResponse(response)
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[]

      messages.push({ role: 'assistant', content: response.content })

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await executeScenarioTool(supabase, ctx, block.name, block.input as Record<string, unknown>)
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

    // Other stop reasons — extract what we can
    return parseActionResponse(response)
  }

  // Exceeded max iterations — return what we have
  return {
    subject: null,
    body_html: '<p>I was unable to complete the request within the allowed number of steps.</p>',
    actions_taken: [{ action: 'Exceeded max tool iterations' }],
  }
}

function parseActionResponse(
  response: Anthropic.Message
): { subject: string | null; body_html: string | null; actions_taken: Record<string, unknown>[] } {
  const textBlock = response.content.find((b) => b.type === 'text')
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        subject: parsed.subject || null,
        body_html: parsed.body_html || null,
        actions_taken: Array.isArray(parsed.actions_taken)
          ? parsed.actions_taken.map((a: string | Record<string, unknown>) =>
              typeof a === 'string' ? { action: a } : a
            )
          : [],
      }
    }
  } catch {
    // Fall through to use raw text
  }

  return {
    subject: null,
    body_html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
    actions_taken: [{ action: 'Generated response (fallback format)' }],
  }
}

// =============================================================================
// Tool handlers — all read-only, org-scoped
// =============================================================================

async function handleSearchInvoices(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { customer_name?: string; invoice_number?: string; status?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(input.limit || 10, 25)

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, status, invoice_type, subtotal, vat_amount, total, due_date, paid_at, sent_at, created_at,
      customers(id, name),
      sales_orders(id, so_number),
      invoice_lines(quantity, unit_price)
    `)
    .eq('org_id', ctx.orgId)
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

  const results = filtered.map((inv) => {
    const customer = inv.customers as unknown as { id: string; name: string } | null
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

    const lines = (inv.invoice_lines || []) as { quantity: number; unit_price: number }[]
    const lineTotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)

    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      effective_status: effectiveStatus,
      invoice_type: inv.invoice_type,
      customer_id: customer?.id || null,
      customer: customer?.name || 'Unknown',
      so_number: so?.so_number || null,
      subtotal: inv.subtotal,
      total: inv.total,
      line_items_total: lineTotal,
      due_date: inv.due_date,
      days_overdue: daysOverdue,
      paid_at: inv.paid_at,
      sent_at: inv.sent_at,
      created_at: inv.created_at,
    }
  })

  const finalResults = input.status
    ? results.filter((r) => r.effective_status === input.status)
    : results

  return JSON.stringify({ results: finalResults, count: finalResults.length })
}

async function handleGetInvoiceDetails(
  supabase: AdminClient,
  ctx: ToolContext,
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
    .eq('org_id', ctx.orgId)
    .single()

  if (error || !inv) return JSON.stringify({ error: 'Invoice not found.' })

  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('id, description, quantity, unit_price, vat_rate, group_name, products(name, sku)')
    .eq('invoice_id', input.invoice_id)
    .order('sort_order', { ascending: true })

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
    vat_rate: number; group_name: string | null;
    products: { name: string; sku: string } | null;
  }[]

  // Note: unit_cost deliberately excluded — this is customer-facing, no margin data
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
    total: inv.total,
    notes: inv.notes,
    created_at: inv.created_at,
    lines: allLines.map((l) => ({
      description: l.description,
      product: l.products?.name || null,
      sku: l.products?.sku || null,
      quantity: l.quantity,
      unit_price: l.unit_price,
      line_total: l.quantity * l.unit_price,
      vat_rate: l.vat_rate,
      group_name: l.group_name,
    })),
    portal_link: `/portal/invoices`,
  })
}

async function handleSearchContracts(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { customer_name?: string; status?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(input.limit || 10, 25)

  let query = supabase
    .from('customer_contracts')
    .select(`
      id, name, status, start_date, end_date, monthly_hours, created_at,
      customers(id, name),
      contract_types(name, includes_remote_support, includes_telephone, includes_onsite)
    `)
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) return JSON.stringify({ results: [], message: 'No contracts found.' })

  let filtered = data as (typeof data[0])[]

  if (input.customer_name) {
    const search = input.customer_name.toLowerCase()
    filtered = filtered.filter((c) => {
      const customer = c.customers as unknown as { name: string } | null
      return customer?.name?.toLowerCase().includes(search)
    })
  }

  return JSON.stringify({
    results: filtered.map((c) => {
      const customer = c.customers as unknown as { id: string; name: string } | null
      const type = c.contract_types as unknown as { name: string; includes_remote_support: boolean; includes_telephone: boolean; includes_onsite: boolean } | null
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        customer_id: customer?.id || null,
        customer: customer?.name || 'Unknown',
        contract_type: type?.name || null,
        includes_remote_support: type?.includes_remote_support || false,
        includes_telephone: type?.includes_telephone || false,
        includes_onsite: type?.includes_onsite || false,
        monthly_hours: c.monthly_hours,
        start_date: c.start_date,
        end_date: c.end_date,
      }
    }),
    count: filtered.length,
  })
}

async function handleGetContractDetails(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { contract_id: string }
): Promise<string> {
  const { data: contract, error } = await supabase
    .from('customer_contracts')
    .select(`
      *,
      customers(id, name),
      contract_types(name, includes_remote_support, includes_telephone, includes_onsite, allowed_schedule_weeks),
      sla_plans(name, description),
      contract_visit_slots(id, day_of_week, start_time, end_time, cycle_week_numbers)
    `)
    .eq('id', input.contract_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (error || !contract) return JSON.stringify({ error: 'Contract not found.' })

  const customer = contract.customers as unknown as { id: string; name: string } | null
  const type = contract.contract_types as unknown as { name: string; includes_remote_support: boolean; includes_telephone: boolean; includes_onsite: boolean; allowed_schedule_weeks: number[] | null } | null
  const sla = contract.sla_plans as unknown as { name: string; description: string | null } | null
  const slots = (contract.contract_visit_slots || []) as unknown as { id: string; day_of_week: number; start_time: string; end_time: string; cycle_week_numbers: number[] }[]

  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return JSON.stringify({
    id: contract.id,
    name: contract.name,
    status: contract.status,
    customer: customer?.name || 'Unknown',
    contract_type: type?.name || null,
    includes_remote_support: type?.includes_remote_support || false,
    includes_telephone: type?.includes_telephone || false,
    includes_onsite: type?.includes_onsite || false,
    sla_plan: sla?.name || null,
    monthly_hours: contract.monthly_hours,
    start_date: contract.start_date,
    end_date: contract.end_date,
    renewal_date: contract.renewal_date,
    notes: contract.notes,
    visit_slots: slots.map((s) => ({
      day: dayNames[s.day_of_week] || `Day ${s.day_of_week}`,
      start_time: s.start_time,
      end_time: s.end_time,
      cycle_weeks: s.cycle_week_numbers,
    })),
    portal_link: `/portal/contracts`,
  })
}

async function handleSearchQuotes(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { customer_name?: string; quote_number?: string; status?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(input.limit || 10, 25)

  let query = supabase
    .from('quotes')
    .select(`
      id, quote_number, status, created_at, valid_until,
      customers(id, name),
      quote_lines(quantity, sell_price, is_optional)
    `)
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.quote_number) {
    query = query.ilike('quote_number', `%${input.quote_number}%`)
  }
  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) return JSON.stringify({ results: [], message: 'No quotes found.' })

  let filtered = data as (typeof data[0])[]

  if (input.customer_name) {
    const search = input.customer_name.toLowerCase()
    filtered = filtered.filter((q) => {
      const customer = q.customers as unknown as { name: string } | null
      return customer?.name?.toLowerCase().includes(search)
    })
  }

  return JSON.stringify({
    results: filtered.map((q) => {
      const customer = q.customers as unknown as { id: string; name: string } | null
      const lines = (q.quote_lines || []) as { quantity: number; sell_price: number; is_optional: boolean }[]
      const firm = lines.filter((l) => !l.is_optional)
      const value = firm.reduce((s, l) => s + l.quantity * l.sell_price, 0)
      return {
        id: q.id,
        quote_number: q.quote_number,
        status: q.status,
        customer_id: customer?.id || null,
        customer: customer?.name || 'Unknown',
        value,
        line_count: lines.length,
        valid_until: q.valid_until,
        created_at: q.created_at,
      }
    }),
    count: filtered.length,
  })
}

async function handleGetQuoteDetails(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { quote_id: string }
): Promise<string> {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, status, title, notes, valid_until, created_at,
      customers(id, name),
      contacts(id, first_name, last_name),
      brands(name),
      quote_groups(id, name, sort_order),
      quote_lines(id, description, quantity, sell_price, vat_rate, is_optional, group_id, sort_order, products(name, sku))
    `)
    .eq('id', input.quote_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (error || !quote) return JSON.stringify({ error: 'Quote not found.' })

  const customer = quote.customers as unknown as { name: string } | null
  const contact = quote.contacts as unknown as { first_name: string; last_name: string } | null
  const brand = quote.brands as unknown as { name: string } | null
  const groups = (quote.quote_groups || []) as unknown as { id: string; name: string; sort_order: number }[]
  const lines = (quote.quote_lines || []) as unknown as {
    id: string; description: string; quantity: number; sell_price: number;
    vat_rate: number; is_optional: boolean; group_id: string | null; sort_order: number;
    products: { name: string; sku: string } | null;
  }[]

  const firmLines = lines.filter((l) => !l.is_optional)
  const subtotal = firmLines.reduce((s, l) => s + l.quantity * l.sell_price, 0)

  return JSON.stringify({
    quote_number: quote.quote_number,
    status: quote.status,
    title: quote.title,
    customer: customer?.name || 'Unknown',
    contact: contact ? `${contact.first_name} ${contact.last_name}` : null,
    brand: brand?.name || null,
    notes: quote.notes,
    valid_until: quote.valid_until,
    created_at: quote.created_at,
    subtotal,
    groups: groups.sort((a, b) => a.sort_order - b.sort_order).map((g) => ({
      name: g.name,
      lines: lines
        .filter((l) => l.group_id === g.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({
          description: l.description,
          product: l.products?.name || null,
          quantity: l.quantity,
          unit_price: l.sell_price,
          line_total: l.quantity * l.sell_price,
          is_optional: l.is_optional,
        })),
    })),
    portal_link: `/portal/quotes`,
  })
}

async function handleSearchSalesOrders(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { customer_name?: string; so_number?: string; status?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(input.limit || 10, 25)

  let query = supabase
    .from('sales_orders')
    .select(`
      id, so_number, customer_po, created_at,
      customers(id, name),
      sales_order_lines(id, status, quantity, sell_price)
    `)
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.so_number) {
    query = query.ilike('so_number', `%${input.so_number}%`)
  }

  const { data, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) return JSON.stringify({ results: [], message: 'No sales orders found.' })

  let filtered = data as (typeof data[0])[]

  if (input.customer_name) {
    const search = input.customer_name.toLowerCase()
    filtered = filtered.filter((o) => {
      const customer = o.customers as unknown as { name: string } | null
      return customer?.name?.toLowerCase().includes(search)
    })
  }

  const results = filtered.map((o) => {
    const customer = o.customers as unknown as { id: string; name: string } | null
    const lines = (o.sales_order_lines || []) as { id: string; status: string; quantity: number; sell_price: number }[]
    const derived = deriveSoStatus(lines)
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.sell_price, 0)

    return {
      id: o.id,
      so_number: o.so_number,
      derived_status: derived,
      customer_id: customer?.id || null,
      customer: customer?.name || 'Unknown',
      customer_po: o.customer_po,
      line_count: lines.length,
      subtotal,
      created_at: o.created_at,
    }
  })

  const finalResults = input.status
    ? results.filter((r) => r.derived_status === input.status)
    : results

  return JSON.stringify({ results: finalResults, count: finalResults.length })
}

async function handleGetSalesOrderDetails(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { sales_order_id: string }
): Promise<string> {
  const { data: so, error } = await supabase
    .from('sales_orders')
    .select(`
      id, so_number, customer_po, notes, created_at,
      customers(id, name),
      contacts(id, first_name, last_name),
      sales_order_lines(id, description, status, quantity, sell_price, fulfilment_route, quantity_received, quantity_invoiced, products(name, sku))
    `)
    .eq('id', input.sales_order_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (error || !so) return JSON.stringify({ error: 'Sales order not found.' })

  const customer = so.customers as unknown as { name: string } | null
  const contact = so.contacts as unknown as { first_name: string; last_name: string } | null
  const lines = (so.sales_order_lines || []) as unknown as {
    id: string; description: string; status: string; quantity: number;
    sell_price: number; fulfilment_route: string;
    quantity_received: number; quantity_invoiced: number;
    products: { name: string; sku: string } | null;
  }[]

  const derived = deriveSoStatus(lines as { status: string }[])
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.sell_price, 0)

  return JSON.stringify({
    so_number: so.so_number,
    derived_status: derived,
    customer: customer?.name || 'Unknown',
    contact: contact ? `${contact.first_name} ${contact.last_name}` : null,
    customer_po: so.customer_po,
    notes: so.notes,
    subtotal,
    created_at: so.created_at,
    lines: lines.map((l) => ({
      description: l.description,
      product: l.products?.name || null,
      sku: l.products?.sku || null,
      status: l.status,
      quantity: l.quantity,
      unit_price: l.sell_price,
      line_total: l.quantity * l.sell_price,
      fulfilment_route: l.fulfilment_route,
      quantity_received: l.quantity_received,
      quantity_invoiced: l.quantity_invoiced,
    })),
    portal_link: `/portal/orders`,
  })
}

async function handleSearchTickets(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { customer_name?: string; ticket_number?: string; status?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(input.limit || 10, 25)

  let query = supabase
    .from('v_ticket_summary')
    .select('id, ticket_number, subject, status, priority, created_at, updated_at, customer_name, assigned_to_name')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.ticket_number) {
    query = query.ilike('ticket_number', `%${input.ticket_number}%`)
  }
  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) return JSON.stringify({ results: [], message: 'No tickets found.' })

  let filtered = data as (typeof data[0])[]

  if (input.customer_name) {
    const search = input.customer_name.toLowerCase()
    filtered = filtered.filter((t) =>
      (t.customer_name as string | null)?.toLowerCase()?.includes(search)
    )
  }

  return JSON.stringify({
    results: filtered.map((t) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      customer: t.customer_name || 'Unknown',
      assigned_to: t.assigned_to_name || 'Unassigned',
      created_at: t.created_at,
      updated_at: t.updated_at,
    })),
    count: filtered.length,
  })
}

async function handleGetCustomerDetails(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { customer_id: string }
): Promise<string> {
  const [
    { data: customer, error },
    { data: contacts },
    { data: contracts },
    { data: recentInvoices },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, customer_type, account_number, phone, email, city, postcode')
      .eq('id', input.customer_id)
      .eq('org_id', ctx.orgId)
      .single(),
    supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, job_title, is_primary')
      .eq('customer_id', input.customer_id)
      .eq('is_active', true)
      .order('is_primary', { ascending: false }),
    supabase
      .from('customer_contracts')
      .select('id, name, status, contract_types(name)')
      .eq('customer_id', input.customer_id)
      .eq('org_id', ctx.orgId)
      .eq('status', 'active'),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total, due_date, created_at')
      .eq('customer_id', input.customer_id)
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (error || !customer) return JSON.stringify({ error: 'Customer not found.' })

  return JSON.stringify({
    id: customer.id,
    name: customer.name,
    customer_type: customer.customer_type,
    account_number: customer.account_number,
    phone: customer.phone,
    email: customer.email,
    location: [customer.city, customer.postcode].filter(Boolean).join(', '),
    contacts: (contacts || []).map((c) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
      phone: c.phone,
      job_title: c.job_title,
      is_primary: c.is_primary,
    })),
    active_contracts: (contracts || []).map((c) => {
      const type = c.contract_types as unknown as { name: string } | null
      return { id: c.id, name: c.name, type: type?.name || null }
    }),
    recent_invoices: (recentInvoices || []).map((inv) => {
      const effectiveStatus = getEffectiveInvoiceStatus(
        inv.status as Parameters<typeof getEffectiveInvoiceStatus>[0],
        inv.due_date
      )
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        effective_status: effectiveStatus,
        total: inv.total,
        due_date: inv.due_date,
        created_at: inv.created_at,
      }
    }),
    portal_link: `/portal/dashboard`,
  })
}

async function handleSearchCustomers(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { name?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(input.limit || 10, 25)

  let query = supabase
    .from('customers')
    .select('id, name, customer_type, account_number, city, postcode, is_active')
    .eq('org_id', ctx.orgId)
    .eq('is_active', true)
    .order('name')
    .limit(limit)

  if (input.name) {
    query = query.ilike('name', `%${input.name}%`)
  }

  const { data, error } = await query

  if (error) return JSON.stringify({ error: error.message })
  if (!data || data.length === 0) return JSON.stringify({ results: [], message: 'No customers found.' })

  return JSON.stringify({
    results: data.map((c) => ({
      id: c.id,
      name: c.name,
      customer_type: c.customer_type,
      account_number: c.account_number,
      location: [c.city, c.postcode].filter(Boolean).join(', '),
    })),
    count: data.length,
  })
}

async function handleFindCustomerByEmail(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { email: string }
): Promise<string> {
  const email = input.email.toLowerCase().trim()
  const domain = email.split('@')[1]

  if (!domain) return JSON.stringify({ error: 'Invalid email address — no domain found.' })

  // Strategy 1: Check customer_email_domains table (fastest, most reliable)
  const { data: domainMatch } = await supabase
    .from('customer_email_domains')
    .select('customer_id, domain, customers(id, name, customer_type, account_number, city, postcode)')
    .eq('org_id', ctx.orgId)
    .eq('domain', domain)
    .limit(5)

  if (domainMatch && domainMatch.length > 0) {
    const results = domainMatch.map((d) => {
      const customer = d.customers as unknown as { id: string; name: string; customer_type: string; account_number: string | null; city: string | null; postcode: string | null } | null
      return {
        id: customer?.id || d.customer_id,
        name: customer?.name || 'Unknown',
        customer_type: customer?.customer_type || null,
        account_number: customer?.account_number || null,
        location: [customer?.city, customer?.postcode].filter(Boolean).join(', '),
        matched_via: 'email_domain',
        domain,
      }
    })
    return JSON.stringify({ results, count: results.length, match_method: 'customer_email_domains' })
  }

  // Strategy 2: Search contacts by email_domain column
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email_domain, customer_id, customers!inner(id, name, customer_type, account_number, org_id, city, postcode)')
    .eq('email_domain', domain)
    .eq('is_active', true)
    .limit(10)

  if (contacts && contacts.length > 0) {
    // Filter to contacts whose customer belongs to this org
    const orgContacts = contacts.filter((c) => {
      const cust = c.customers as unknown as { org_id: string }
      return cust.org_id === ctx.orgId
    })

    if (orgContacts.length > 0) {
      // Deduplicate by customer_id
      const seen = new Set<string>()
      const results = orgContacts
        .filter((c) => {
          if (seen.has(c.customer_id)) return false
          seen.add(c.customer_id)
          return true
        })
        .map((c) => {
          const customer = c.customers as unknown as { id: string; name: string; customer_type: string; account_number: string | null; city: string | null; postcode: string | null }
          return {
            id: customer.id,
            name: customer.name,
            customer_type: customer.customer_type,
            account_number: customer.account_number,
            location: [customer.city, customer.postcode].filter(Boolean).join(', '),
            matched_via: 'contact_email_domain',
            domain,
            contact_name: `${c.first_name} ${c.last_name}`,
          }
        })
      return JSON.stringify({ results, count: results.length, match_method: 'contact_email_domain' })
    }
  }

  return JSON.stringify({ results: [], count: 0, message: `No customer found for email domain "${domain}".` })
}

async function handleGeneratePortalLink(
  supabase: AdminClient,
  ctx: ToolContext,
  input: { contact_email: string }
): Promise<string> {
  const email = input.contact_email.toLowerCase().trim()
  const domain = email.split('@')[1]

  if (!domain) return JSON.stringify({ error: 'Invalid email address.' })

  // Find the contact's portal user
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email_domain, customer_id, customers!inner(org_id)')
    .eq('email_domain', domain)
    .eq('is_active', true)
    .limit(10)

  if (!contacts || contacts.length === 0) {
    return JSON.stringify({ error: 'No contact found for this email address.' })
  }

  // Filter to this org
  const orgContact = contacts.find((c) => {
    const cust = c.customers as unknown as { org_id: string }
    return cust.org_id === ctx.orgId
  })

  if (!orgContact) {
    return JSON.stringify({ error: 'No contact found for this email in your organisation.' })
  }

  // Check if they have portal access
  const { data: portalUser } = await supabase
    .from('portal_users')
    .select('id, is_active')
    .eq('contact_id', orgContact.id)
    .eq('org_id', ctx.orgId)
    .single()

  if (!portalUser || !portalUser.is_active) {
    return JSON.stringify({
      error: 'This contact does not have portal access enabled. An admin can enable it from the customer detail page.',
      contact_name: `${orgContact.first_name} ${orgContact.last_name}`,
    })
  }

  // Invalidate existing unused magic links
  await supabase
    .from('portal_magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('portal_user_id', portalUser.id)
    .is('used_at', null)

  // Generate new magic link token
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const { error: insertError } = await supabase.from('portal_magic_links').insert({
    portal_user_id: portalUser.id,
    token,
  })

  if (insertError) {
    return JSON.stringify({ error: 'Failed to generate portal link.' })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const portalLink = `${siteUrl}/portal/auth/${token}`

  return JSON.stringify({
    portal_link: portalLink,
    contact_name: `${orgContact.first_name} ${orgContact.last_name}`,
    expires_in: '15 minutes',
    note: 'Include this link in the email so the customer can access the portal with one click. The link is single-use and expires in 15 minutes.',
  })
}
