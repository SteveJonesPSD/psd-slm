import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const BASE_PROMPT = `You are Helen, PSD Group's helpdesk assistant. You help staff with support ticket queries, SLA information, customer contract details, team workload, and troubleshooting guidance. Be helpful, professional, and concise. Use British English.

You have access to live helpdesk data which is included below. Use this data to answer questions accurately. If asked about something not covered by the data provided, say so honestly rather than guessing.

## Formatting
- Your responses support Markdown — use **bold**, *italic*, bullet points, numbered lists, and tables
- CRITICAL: When referencing tickets, customers, or any records, ALWAYS use markdown links with the record's UUID from the data provided. The link MUST point to the detail page, not the list page. Examples:
  - Ticket: [TKT-2026-0001](/helpdesk/tickets/{id}) — uses the ticket's "id" field
  - Customer: [Customer Name](/customers/{id})
- In tables, ALWAYS make reference number columns a markdown link: | [TKT-2026-0001](/helpdesk/tickets/{id}) | ...
- Tables MUST have a MAXIMUM of 3 columns. Your responses are displayed in a narrow chat bubble — wide tables break the layout. Put extra detail in a summary sentence below the table, not in extra columns. Keep column content short.
- NEVER output a ticket/reference number without making it a markdown link to its detail page
- Do NOT output bare URLs — always wrap them in markdown link syntax
- Present ticket numbers in full format (e.g. TKT-2026-0001)
- Format times using 12-hour format with am/pm
- Format currency as GBP where relevant`

async function getAppUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: appUser } = await supabase
    .from('users')
    .select('id, org_id, first_name, last_name')
    .eq('auth_id', authUser.id)
    .eq('is_active', true)
    .single()

  return appUser
}

async function buildHelpdeskContext(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string> {
  const now = new Date().toISOString()

  // Fetch all data concurrently
  const [
    ticketsResult,
    workloadResult,
    slaResult,
    contractsResult,
    categoriesResult,
    tagsResult,
    recentResolvedResult,
    draftsResult,
  ] = await Promise.all([
    // Active tickets from the summary view
    supabase
      .from('v_ticket_summary')
      .select('*')
      .eq('org_id', orgId)
      .not('status', 'in', '("closed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(100),

    // Agent workload
    supabase
      .from('v_agent_workload')
      .select('*'),

    // SLA compliance (last 3 months)
    supabase
      .from('v_sla_compliance')
      .select('*')
      .eq('org_id', orgId)
      .order('period', { ascending: false })
      .limit(3),

    // Active support contracts
    supabase
      .from('support_contracts')
      .select('id, name, contract_type, monthly_hours, start_date, end_date, is_active, customers(name), sla_plans(name)')
      .eq('org_id', orgId)
      .eq('is_active', true),

    // Ticket categories
    supabase
      .from('ticket_categories')
      .select('id, name, parent_id, is_active')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('sort_order'),

    // Tags
    supabase
      .from('ticket_tags')
      .select('id, name, color, is_active')
      .eq('org_id', orgId)
      .eq('is_active', true),

    // Recently resolved tickets (last 7 days)
    supabase
      .from('v_ticket_summary')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'resolved')
      .gte('resolved_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('resolved_at', { ascending: false })
      .limit(20),

    // Pending Helen drafts
    supabase
      .from('helen_draft_responses')
      .select('id, ticket_id, draft_type, status, created_at')
      .eq('org_id', orgId)
      .eq('status', 'pending'),
  ])

  const tickets = ticketsResult.data || []
  const workload = workloadResult.data || []
  const sla = slaResult.data || []
  const contracts = contractsResult.data || []
  const categories = categoriesResult.data || []
  const tags = tagsResult.data || []
  const recentResolved = recentResolvedResult.data || []
  const drafts = draftsResult.data || []

  // Compute stats
  const byStatus: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byAssignee: Record<string, number> = {}
  const unassigned: typeof tickets = []
  const breached: typeof tickets = []

  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1

    if (t.assigned_to_name) {
      byAssignee[t.assigned_to_name] = (byAssignee[t.assigned_to_name] || 0) + 1
    } else {
      unassigned.push(t)
    }

    const slaResponseBreached = t.sla_response_due_at && !t.first_responded_at && new Date(t.sla_response_due_at) < new Date(now)
    const slaResolutionBreached = t.sla_resolution_due_at && !t.resolved_at && new Date(t.sla_resolution_due_at) < new Date(now)
    if (slaResponseBreached || slaResolutionBreached) {
      breached.push(t)
    }
  }

  // Build context string
  let ctx = `\n\n## Current Helpdesk Data (as of ${new Date().toLocaleString('en-GB')})\n`

  // Summary stats
  ctx += `\n### Ticket Summary\n`
  ctx += `- **Total active tickets:** ${tickets.length}\n`
  for (const [status, count] of Object.entries(byStatus).sort()) {
    ctx += `- ${status}: ${count}\n`
  }

  ctx += `\n### By Priority\n`
  for (const p of ['urgent', 'high', 'medium', 'low']) {
    if (byPriority[p]) ctx += `- ${p}: ${byPriority[p]}\n`
  }

  if (unassigned.length > 0) {
    ctx += `\n### Unassigned Tickets (${unassigned.length})\n`
    for (const t of unassigned.slice(0, 10)) {
      ctx += `- ${t.ticket_number} — "${t.subject}" (${t.priority}, ${t.status}, customer: ${t.customer_name})\n`
    }
    if (unassigned.length > 10) ctx += `- ...and ${unassigned.length - 10} more\n`
  }

  if (breached.length > 0) {
    ctx += `\n### SLA Breached Tickets (${breached.length})\n`
    for (const t of breached.slice(0, 10)) {
      const responseBreached = t.sla_response_due_at && !t.first_responded_at && new Date(t.sla_response_due_at) < new Date(now)
      const resolutionBreached = t.sla_resolution_due_at && !t.resolved_at && new Date(t.sla_resolution_due_at) < new Date(now)
      const breachType = responseBreached && resolutionBreached ? 'response + resolution' : responseBreached ? 'response' : 'resolution'
      ctx += `- ${t.ticket_number} — "${t.subject}" (${breachType} breached, assigned: ${t.assigned_to_name || 'unassigned'})\n`
    }
  }

  // Frustrated customers (AutoGRUMP)
  const frustrated = tickets.filter((t: Record<string, unknown>) => (t.tone_score as number) >= 3)
  if (frustrated.length > 0) {
    const scoreLabel = (s: number) => s === 3 ? 'mildly frustrated' : s === 4 ? 'frustrated' : s === 5 ? 'angry' : 'unknown'
    ctx += `\n### Frustrated Customers (${frustrated.length} tickets)\n`
    for (const t of frustrated) {
      const tone = t as unknown as Record<string, unknown>
      ctx += `- ${t.ticket_number} — "${t.subject}" | customer: ${t.customer_name} | tone: ${scoreLabel(tone.tone_score as number)} (${tone.tone_score}/5, ${tone.tone_trend}) | ${tone.tone_summary || ''}\n`
    }
    ctx += `\nNote: These customers may need prioritised, empathetic responses.\n`
  }

  // All active tickets listing
  ctx += `\n### All Active Tickets\n`
  for (const t of tickets) {
    const slaInfo = []
    if (t.sla_response_due_at) slaInfo.push(`resp due: ${new Date(t.sla_response_due_at).toLocaleString('en-GB')}`)
    if (t.sla_resolution_due_at) slaInfo.push(`res due: ${new Date(t.sla_resolution_due_at).toLocaleString('en-GB')}`)
    const slaStr = slaInfo.length > 0 ? ` [${slaInfo.join(', ')}]` : ''
    const toneStr = (t as unknown as Record<string, unknown>).tone_score ? ` | tone: ${(t as unknown as Record<string, unknown>).tone_score}/5` : ''
    ctx += `- ${t.ticket_number} | ${t.status} | ${t.priority} | "${t.subject}" | customer: ${t.customer_name} | assigned: ${t.assigned_to_name || 'unassigned'} | category: ${t.category_name || 'none'} | created: ${new Date(t.created_at).toLocaleString('en-GB')}${slaStr}${toneStr}\n`
  }

  // Recently resolved
  if (recentResolved.length > 0) {
    ctx += `\n### Recently Resolved (last 7 days): ${recentResolved.length} tickets\n`
    for (const t of recentResolved.slice(0, 10)) {
      ctx += `- ${t.ticket_number} — "${t.subject}" (resolved: ${t.resolved_at ? new Date(t.resolved_at).toLocaleString('en-GB') : 'N/A'}, customer: ${t.customer_name})\n`
    }
  }

  // Team workload
  if (workload.length > 0) {
    ctx += `\n### Team Workload\n`
    for (const w of workload) {
      ctx += `- ${w.user_name} (${w.role_name}): ${w.open_tickets} open, ${w.new_tickets} new, ${w.urgent_tickets} urgent, ${w.time_today_minutes}min logged today\n`
    }
  }

  // SLA compliance
  if (sla.length > 0) {
    ctx += `\n### SLA Compliance (recent months)\n`
    for (const s of sla) {
      const period = new Date(s.period).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      ctx += `- ${period}: ${s.total_tickets} tickets, response ${s.response_pct}%, resolution ${s.resolution_pct}%\n`
    }
  }

  // Contracts
  if (contracts.length > 0) {
    ctx += `\n### Active Support Contracts\n`
    for (const c of contracts) {
      const customer = (c.customers as unknown as { name: string })?.name || 'Unknown'
      const slaPlan = (c.sla_plans as unknown as { name: string })?.name || 'None'
      ctx += `- "${c.name}" — ${customer} | type: ${c.contract_type} | ${c.monthly_hours ? c.monthly_hours + 'h/month' : 'unlimited'} | SLA: ${slaPlan} | ${c.start_date} to ${c.end_date || 'ongoing'}\n`
    }
  }

  // Categories
  if (categories.length > 0) {
    const parents = categories.filter((c) => !c.parent_id)
    ctx += `\n### Ticket Categories\n`
    for (const p of parents) {
      const children = categories.filter((c) => c.parent_id === p.id)
      if (children.length > 0) {
        ctx += `- ${p.name}: ${children.map((c) => c.name).join(', ')}\n`
      } else {
        ctx += `- ${p.name}\n`
      }
    }
  }

  // Tags
  if (tags.length > 0) {
    ctx += `\n### Active Tags\n`
    ctx += tags.map((t) => t.name).join(', ') + '\n'
  }

  // Pending drafts
  if (drafts.length > 0) {
    ctx += `\n### Pending Helen AI Drafts: ${drafts.length}\n`
  }

  return ctx
}

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
    const helpdeskContext = await buildHelpdeskContext(supabase, appUser.org_id)
    const systemPrompt = BASE_PROMPT + helpdeskContext

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    return NextResponse.json({
      message: { role: 'assistant', content },
    })
  } catch (err) {
    console.error('Helen agent error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
