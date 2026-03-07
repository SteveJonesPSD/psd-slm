import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface NudgeRequest {
  ticketId: string
  ticketContext: {
    ticketNumber: string
    subject: string
    customerName: string
    contactName: string | null
    messages: {
      senderType: 'agent' | 'customer' | 'system'
      senderName: string | null
      body: string
      isInternal: boolean
      createdAt: string
    }[]
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()
  const { data: appUser } = await adminSupabase
    .from('users')
    .select('id, org_id, first_name, last_name')
    .eq('auth_id', authUser.id)
    .eq('is_active', true)
    .single()

  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  const body: NudgeRequest = await req.json()
  const { ticketId, ticketContext } = body

  if (!ticketId || !ticketContext) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Load Helen persona + guardrails
  const { data: settings } = await adminSupabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', appUser.org_id)
    .eq('category', 'helen')
    .in('setting_key', ['helen_persona', 'helen_guardrails', 'helen_nudge_guardrails'])

  const settingsMap: Record<string, string> = {}
  for (const s of settings || []) {
    settingsMap[s.setting_key] = String(s.setting_value ?? '')
  }

  const persona = settingsMap.helen_persona || 'You are Helen, a friendly and professional IT support assistant.'
  const generalGuardrails = settingsMap.helen_guardrails || ''
  const nudgeGuardrails = settingsMap.helen_nudge_guardrails || ''

  // Build conversation history for context
  const conversationHistory = ticketContext.messages
    .filter(m => !m.isInternal)
    .map(m => {
      const role = m.senderType === 'customer' ? 'Customer' : m.senderType === 'system' ? 'System' : (m.senderName || 'Agent')
      const date = new Date(m.createdAt).toLocaleString('en-GB')
      return `[${date}] ${role}: ${m.body}`
    })
    .join('\n\n')

  const lastCustomerMessage = ticketContext.messages
    .filter(m => m.senderType === 'customer' && !m.isInternal)
    .pop()

  const lastAgentMessage = ticketContext.messages
    .filter(m => m.senderType === 'agent' && !m.isInternal)
    .pop()

  const systemPrompt = `${persona}

${generalGuardrails ? `## General Guardrails\n${generalGuardrails}\n` : ''}${nudgeGuardrails ? `## Nudge Guardrails\n${nudgeGuardrails}\n` : ''}
## Task
You are writing a polite follow-up message (nudge) to a customer who hasn't responded to a support ticket. The goal is to check in and encourage them to reply — either with more information, confirmation the issue is resolved, or acknowledgement.

## Rules
- Use British English
- Do NOT include any greeting line like "Dear X" or signature — those are added automatically
- Write ONLY the body text of the nudge message`

  const userPrompt = `Ticket: ${ticketContext.ticketNumber}
Subject: ${ticketContext.subject}
Customer: ${ticketContext.customerName}
Contact: ${ticketContext.contactName || 'Unknown'}

## Conversation History
${conversationHistory}

${lastAgentMessage ? `## Last Agent Message (awaiting response to this)\n${lastAgentMessage.body}` : ''}
${lastCustomerMessage ? `## Last Customer Message\n${lastCustomerMessage.body}` : ''}

Please write a brief, friendly follow-up nudge message for this ticket.`

  try {
    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    let nudgeText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    // Fetch portal token to append close link
    const { data: tokenRow } = await adminSupabase
      .from('tickets')
      .select('portal_token')
      .eq('id', ticketId)
      .single()

    if (tokenRow?.portal_token) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
      if (siteUrl) {
        nudgeText += `\n\nIf you feel the issue is now resolved and would prefer to close the ticket, please click here: ${siteUrl}/t/${tokenRow.portal_token}/close`
      }
    }

    return NextResponse.json({ nudge: nudgeText })
  } catch (err) {
    console.error('[nudge-api]', err)
    return NextResponse.json({ error: 'Failed to generate nudge' }, { status: 500 })
  }
}
