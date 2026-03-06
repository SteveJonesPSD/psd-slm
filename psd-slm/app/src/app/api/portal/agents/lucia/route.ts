import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getPortalContextFromRequest } from '@/lib/portal/session'
import { getPortalOrders, getPortalOrderDetail } from '@/lib/portal/orders-actions'
import { getPortalContracts } from '@/lib/portal/contracts-actions'
import { getPortalUpcomingVisits } from '@/lib/portal/visits-actions'

const PORTAL_AGENT_PREFIX = `You are assisting a customer of PSD Group via their customer portal.
You may ONLY discuss information relating to this specific customer.
NEVER reveal data belonging to any other customer.
NEVER reveal internal pricing, buy costs, margins, supplier names, or internal notes.
NEVER reveal internal reference numbers for purchase orders.
Keep responses helpful, professional, and concise. Use British English.

## Formatting
- Use Markdown: **bold**, *italic*, bullet points, numbered lists
- When referencing orders, use markdown links: [SO-2026-0001](/portal/orders/{id})
- Tables: max 3 columns, keep content short
- Format times in 12-hour format, currency as GBP
`

const LUCIA_PORTAL_PROMPT = PORTAL_AGENT_PREFIX + `
You are Lucia, an operations assistant. Help the customer with their orders, contracts, and scheduled visits.
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
      name: 'get_my_orders',
      description: 'Get the customer\'s orders.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_order_detail',
      description: 'Get detailed information about a specific order.',
      input_schema: {
        type: 'object' as const,
        properties: {
          order_id: { type: 'string', description: 'The order UUID' },
        },
        required: ['order_id'],
      },
    },
    {
      name: 'get_my_contracts',
      description: 'Get the customer\'s service contracts.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_upcoming_visits',
      description: 'Get upcoming scheduled visits for the customer.',
      input_schema: {
        type: 'object' as const,
        properties: {
          days: { type: 'number', description: 'Number of days to look ahead (default 30)' },
        },
        required: [],
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
        system: LUCIA_PORTAL_PROMPT + contextStr,
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
            case 'get_my_orders': {
              const data = await getPortalOrders(ctx)
              result = JSON.stringify(data)
              break
            }
            case 'get_order_detail': {
              const data = await getPortalOrderDetail(input.order_id as string, ctx)
              result = data ? JSON.stringify(data) : 'Order not found'
              break
            }
            case 'get_my_contracts': {
              const data = await getPortalContracts(ctx)
              result = JSON.stringify(data)
              break
            }
            case 'get_upcoming_visits': {
              const days = (input.days as number) || 30
              const data = await getPortalUpcomingVisits(ctx, days)
              result = JSON.stringify(data)
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
    console.error('Portal Lucia agent error:', err)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
