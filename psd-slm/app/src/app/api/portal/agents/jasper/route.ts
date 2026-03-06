import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getPortalContextFromRequest } from '@/lib/portal/session'
import { getPortalQuotes, getPortalQuoteDetail } from '@/lib/portal/quotes-actions'

const PORTAL_AGENT_PREFIX = `You are assisting a customer of PSD Group via their customer portal.
You may ONLY discuss information relating to this specific customer.
NEVER reveal data belonging to any other customer.
NEVER reveal internal pricing, buy costs, margins, supplier names, or internal notes.
NEVER reveal internal reference numbers for purchase orders.
Keep responses helpful, professional, and concise. Use British English.

## Formatting
- Use Markdown: **bold**, *italic*, bullet points, numbered lists
- When referencing quotes, use markdown links: [Q-2026-0001](/portal/quotes/{id})
- Tables: max 3 columns, keep content short
- Format times in 12-hour format, currency as GBP
`

const JASPER_PORTAL_PROMPT = PORTAL_AGENT_PREFIX + `
You are Jasper, a sales assistant. Help the customer understand their quotes, compare options, and make decisions.
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
      name: 'get_my_quotes',
      description: 'Get the customer\'s quotes. Optionally filter by status.',
      input_schema: {
        type: 'object' as const,
        properties: {
          status: { type: 'string', enum: ['sent', 'accepted', 'declined', 'expired'], description: 'Filter by status' },
        },
        required: [],
      },
    },
    {
      name: 'get_quote_detail',
      description: 'Get detailed information about a specific quote including line items and pricing.',
      input_schema: {
        type: 'object' as const,
        properties: {
          quote_id: { type: 'string', description: 'The quote UUID' },
        },
        required: ['quote_id'],
      },
    },
  ]

  try {
    const client = new Anthropic({ apiKey })
    let messages = body.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const contextStr = `\n\nCustomer: ${ctx.customerName}\n`

    for (let i = 0; i < 10; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: JASPER_PORTAL_PROMPT + contextStr,
        messages,
        tools,
      })

      const toolUses = response.content.filter((b) => b.type === 'tool_use')
      if (toolUses.length === 0) {
        const textBlock = response.content.find((b) => b.type === 'text')
        const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''
        return NextResponse.json({ message: { role: 'assistant', content } })
      }

      messages = [...messages, { role: 'assistant' as const, content: response.content as unknown as string }]
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUses) {
        if (toolUse.type !== 'tool_use') continue
        const input = toolUse.input as Record<string, unknown>

        let result: string
        try {
          switch (toolUse.name) {
            case 'get_my_quotes': {
              const data = await getPortalQuotes(ctx)
              if (input.status) {
                const filtered = data.filter((q) => q.status === input.status)
                result = JSON.stringify(filtered)
              } else {
                result = JSON.stringify(data)
              }
              break
            }
            case 'get_quote_detail': {
              const data = await getPortalQuoteDetail(input.quote_id as string, ctx)
              result = data ? JSON.stringify(data) : 'Quote not found'
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
    console.error('Portal Jasper agent error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
