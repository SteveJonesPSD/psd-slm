import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getPortalContextFromRequest } from '@/lib/portal/session'
import { getPortalTickets, getPortalTicketDetail, createPortalTicket } from '@/lib/portal/helpdesk-actions'
import { createAdminClient } from '@/lib/supabase/admin'

const PORTAL_AGENT_PREFIX = `You are assisting a customer of PSD Group via their customer portal.
You may ONLY discuss information relating to this specific customer.
NEVER reveal data belonging to any other customer.
NEVER reveal internal pricing, buy costs, margins, supplier names, or internal notes.
NEVER reveal internal reference numbers for purchase orders.
Keep responses helpful, professional, and concise. Use British English.

## Formatting
- Use Markdown: **bold**, *italic*, bullet points, numbered lists
- When referencing tickets, use markdown links: [TKT-2026-0001](/portal/helpdesk/{id})
- Tables: max 3 columns, keep content short
- Format times in 12-hour format, currency as GBP
`

const HELEN_PORTAL_PROMPT = PORTAL_AGENT_PREFIX + `
You are Helen, a support assistant. Help the customer with their support tickets, answer troubleshooting questions, and search the knowledge base.
`

export async function POST(request: NextRequest) {
  const ctx = await getPortalContextFromRequest(request)
  if (!ctx) {
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

  const tools: Anthropic.Tool[] = [
    {
      name: 'get_my_tickets',
      description: 'Get the customer\'s support tickets. Optionally filter by status: open, closed, or all.',
      input_schema: {
        type: 'object' as const,
        properties: {
          status: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter by status' },
        },
        required: [],
      },
    },
    {
      name: 'get_ticket_detail',
      description: 'Get detailed information about a specific support ticket including the message thread.',
      input_schema: {
        type: 'object' as const,
        properties: {
          ticket_id: { type: 'string', description: 'The ticket UUID' },
        },
        required: ['ticket_id'],
      },
    },
    {
      name: 'create_ticket',
      description: 'Create a new support ticket for the customer.',
      input_schema: {
        type: 'object' as const,
        properties: {
          subject: { type: 'string', description: 'Ticket subject' },
          description: { type: 'string', description: 'Ticket description' },
        },
        required: ['subject', 'description'],
      },
    },
    {
      name: 'search_knowledge_base',
      description: 'Search the knowledge base for articles that might help answer the customer\'s question.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  ]

  try {
    // Build context
    const tickets = await getPortalTickets(ctx, 'all')
    let contextStr = `\n\nCustomer: ${ctx.customerName}\n`
    contextStr += `Open tickets: ${tickets.filter((t) => !['resolved', 'closed', 'cancelled'].includes(t.status)).length}\n`
    if (tickets.length > 0) {
      contextStr += `\nRecent tickets:\n`
      for (const t of tickets.slice(0, 10)) {
        contextStr += `- [${t.ticketNumber}](/portal/helpdesk/${t.id}) — "${t.subject}" (${t.status}, ${t.priority})\n`
      }
    }

    const client = new Anthropic({ apiKey })
    let messages = body.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Multi-turn tool-calling loop (max 10 iterations)
    for (let i = 0; i < 10; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: HELEN_PORTAL_PROMPT + contextStr,
        messages,
        tools,
      })

      // Check if there are tool calls
      const toolUses = response.content.filter((b) => b.type === 'tool_use')
      if (toolUses.length === 0) {
        const textBlock = response.content.find((b) => b.type === 'text')
        const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''
        return NextResponse.json({ message: { role: 'assistant', content } })
      }

      // Process tool calls
      messages = [...messages, { role: 'assistant' as const, content: response.content as unknown as string }]
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUses) {
        if (toolUse.type !== 'tool_use') continue
        const input = toolUse.input as Record<string, unknown>

        let result: string
        try {
          switch (toolUse.name) {
            case 'get_my_tickets': {
              const status = input.status as 'open' | 'closed' | 'all' | undefined
              const data = await getPortalTickets(ctx, status || 'all')
              result = JSON.stringify(data)
              break
            }
            case 'get_ticket_detail': {
              const data = await getPortalTicketDetail(input.ticket_id as string, ctx)
              result = data ? JSON.stringify(data) : 'Ticket not found'
              break
            }
            case 'create_ticket': {
              const data = await createPortalTicket(
                input.subject as string,
                input.description as string,
                null,
                ctx
              )
              result = data.error ? `Error: ${data.error}` : `Ticket created: ${data.ticketId}`
              break
            }
            case 'search_knowledge_base': {
              const supabase = createAdminClient()
              const { data: articles } = await supabase
                .from('kb_articles')
                .select('id, title, slug, body')
                .eq('org_id', ctx.orgId)
                .eq('status', 'published')
                .eq('is_customer_facing', true)
                .ilike('title', `%${input.query}%`)
                .limit(5)
              result = articles && articles.length > 0
                ? JSON.stringify(articles.map((a) => ({ title: a.title, slug: a.slug, excerpt: a.body?.substring(0, 200) })))
                : 'No matching articles found'
              break
            }
            default:
              result = 'Unknown tool'
          }
        } catch (err) {
          result = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        })
      }

      messages = [...messages, { role: 'user' as const, content: toolResults as unknown as string }]
    }

    return NextResponse.json({ message: { role: 'assistant', content: 'I reached the maximum number of steps. Please try a simpler question.' } })
  } catch (err) {
    console.error('Portal Helen agent error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
