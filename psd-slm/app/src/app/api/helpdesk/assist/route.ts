import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/crypto'
import type { AuthUser } from '@/lib/auth'

interface TicketContext {
  ticketNumber: string
  subject: string
  description: string | null
  customerName: string
  contactName: string | null
  status: string
  priority: string
  ticketType: string
  category: string | null
  categoryId: string | null
  assigneeName: string | null
  messages: {
    senderType: 'agent' | 'customer' | 'system'
    senderName: string | null
    body: string
    isInternal: boolean
    createdAt: string
  }[]
}

interface PriorDiagnostic {
  createdAt: string
  summary: string
  steps: string[]
}

interface AssistRequest {
  ticketId: string
  ticketContext: TicketContext
  additionalContext?: string
  priorDiagnostics?: PriorDiagnostic[]
}

interface AssistStep {
  action: string
  explanation: string
  expectedOutcome: string
}

interface AssistResponse {
  summary: string
  possibleCauses: string[]
  steps: AssistStep[]
  followUpQuestions: string[]
  confidence: 'high' | 'medium' | 'low'
}

async function getApiUser(supabase: Awaited<ReturnType<typeof createClient>>): Promise<(AuthUser & { orgId: string }) | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: appUser } = await supabase
    .from('users')
    .select('id, org_id, email, first_name, last_name, initials, color, avatar_url, must_change_password, role_id, roles(id, name, display_name)')
    .eq('auth_id', authUser.id)
    .eq('is_active', true)
    .single()

  if (!appUser) return null

  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permissions(module, action)')
    .eq('role_id', appUser.role_id)

  const role = appUser.roles as unknown as { id: string; name: string; display_name: string }
  const permissions = (rolePerms || []).map((rp) => {
    const perm = rp.permissions as unknown as { module: string; action: string }
    return `${perm.module}.${perm.action}`
  })

  return {
    id: appUser.id,
    authId: authUser.id,
    orgId: appUser.org_id,
    email: typeof appUser.email === 'string' && appUser.email ? decrypt(appUser.email) : appUser.email,
    firstName: appUser.first_name,
    lastName: appUser.last_name,
    initials: appUser.initials,
    color: appUser.color,
    avatarUrl: appUser.avatar_url ?? null,
    themePreference: 'system',
    viewPreferences: {},
    mustChangePassword: appUser.must_change_password,
    role: {
      id: role.id,
      name: role.name,
      displayName: role.display_name,
    },
    permissions,
  }
}

function buildDiagnosticPrompt(
  context: TicketContext,
  additionalContext: string | undefined,
  priorDiagnostics: PriorDiagnostic[] | undefined,
  helenPersona: string,
  helenGuardrails: string,
  toneData?: { tone_score: number | null; tone_trend: string | null; tone_summary: string | null } | null
): string {
  const conversationHistory = context.messages
    .map((m) => {
      const label = m.isInternal ? `[INTERNAL NOTE]` : `[${m.senderType.toUpperCase()}]`
      const name = m.senderName || 'Unknown'
      const time = new Date(m.createdAt).toLocaleString('en-GB')
      return `${label} ${name} (${time}):\n${m.body}`
    })
    .join('\n\n---\n\n')

  let prompt = `You are Helen, an AI diagnostic assistant for PSD Group's helpdesk team. Your job is to help agents troubleshoot and diagnose technical issues described in support tickets.

${helenPersona ? `## Persona\n${helenPersona}\n` : ''}
${helenGuardrails ? `## Guardrails\n${helenGuardrails}\n` : ''}

## Ticket Details
- **Ticket:** ${context.ticketNumber}
- **Subject:** ${context.subject}
- **Customer:** ${context.customerName}
- **Contact:** ${context.contactName || 'Not specified'}
- **Status:** ${context.status}
- **Priority:** ${context.priority}
- **Type:** ${context.ticketType}
- **Category:** ${context.category || 'Uncategorised'}
- **Assigned to:** ${context.assigneeName || 'Unassigned'}
${toneData?.tone_score && toneData.tone_score >= 3 ? `
## Customer Tone (AutoGRUMP)
- **Frustration level:** ${toneData.tone_score}/5 (${toneData.tone_score === 3 ? 'Mildly frustrated' : toneData.tone_score === 4 ? 'Frustrated' : 'Angry'})
- **Trend:** ${toneData.tone_trend || 'unknown'}
- **Summary:** ${toneData.tone_summary || 'N/A'}
- **Recommendation:** Use empathetic, solution-focused language. Acknowledge the frustration directly.${toneData.tone_trend === 'escalating' ? ' Tone is escalating — prioritise a swift, concrete response.' : ''}
` : ''}${context.description ? `\n## Original Description\n${context.description}` : ''}

## Conversation History
${conversationHistory || 'No messages yet.'}
`

  if (additionalContext) {
    prompt += `\n## What the agent has already tried\n${additionalContext}\n`
  }

  if (priorDiagnostics && priorDiagnostics.length > 0) {
    prompt += `\n## Previous AI Diagnostics on This Ticket\nThe agent has already used AI diagnostic assist ${priorDiagnostics.length} time(s) on this ticket. Previous suggestions that have NOT resolved the issue:\n`
    priorDiagnostics.forEach((d, i) => {
      const time = new Date(d.createdAt).toLocaleString('en-GB')
      prompt += `\n### Diagnostic ${i + 1} (${time})\n`
      prompt += `Summary: ${d.summary}\n`
      if (d.steps.length > 0) {
        prompt += `Steps suggested:\n`
        d.steps.forEach((s, j) => { prompt += `${j + 1}. ${s}\n` })
      }
    })
    prompt += `\nIMPORTANT: Do NOT repeat the same suggestions. The agent needs fresh approaches and alternative diagnostic paths. Build on the conversation that has happened since the previous diagnostics.\n`
  }

  prompt += `
## Instructions
Analyse the ticket and provide a structured diagnostic response. You must respond with valid JSON matching this schema exactly:

{
  "summary": "Brief assessment of the issue (1-2 sentences)",
  "possibleCauses": ["Cause 1", "Cause 2", ...],
  "steps": [
    {
      "action": "What to do",
      "explanation": "Why this helps",
      "expectedOutcome": "What the agent should see if this resolves it"
    }
  ],
  "followUpQuestions": ["Question to ask the customer if needed"],
  "confidence": "high" | "medium" | "low"
}

Guidelines:
- Order steps from most likely to least likely solution
- Be specific and actionable — avoid generic advice like "restart the computer" unless genuinely relevant
- Consider the conversation history to avoid suggesting things already tried
- If the issue description is vague, set confidence to "low" and include follow-up questions
- Limit to 3-5 possible causes and 3-7 resolution steps
- Use British English
- Respond ONLY with the JSON object, no markdown fences or extra text`

  return prompt
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getApiUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check helpdesk permission
  if (!user.permissions.includes('helpdesk.view') && !user.permissions.includes('helpdesk.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
  }

  let body: AssistRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { ticketId, ticketContext, additionalContext, priorDiagnostics } = body
  if (!ticketId || !ticketContext) {
    return NextResponse.json({ error: 'Missing ticketId or ticketContext' }, { status: 400 })
  }

  try {
    // Fetch Helen settings
    const { data: helenSettings } = await supabase
      .from('org_settings')
      .select('setting_key, setting_value')
      .eq('org_id', user.orgId)
      .eq('category', 'helen')

    const settings: Record<string, string> = {}
    for (const s of helenSettings || []) {
      settings[s.setting_key] = (s.setting_value as string) ?? ''
    }

    const helenPersona = settings.helen_persona || ''
    const helenGuardrails = settings.helen_guardrails || ''

    // Fetch tone data for context enrichment
    const { data: toneData } = await supabase
      .from('tickets')
      .select('tone_score, tone_trend, tone_summary')
      .eq('id', ticketId)
      .single()

    const client = new Anthropic({ apiKey })
    const model = 'claude-sonnet-4-20250514'

    const systemPrompt = buildDiagnosticPrompt(ticketContext, additionalContext, priorDiagnostics, helenPersona, helenGuardrails, toneData)

    // Truncate for audit log (first 500 chars of system prompt)
    const requestSummary = systemPrompt.slice(0, 500)

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: 'Diagnose this issue and provide structured troubleshooting steps.',
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const rawContent = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    // Parse the JSON response
    let assistResponse: AssistResponse
    try {
      // Strip any markdown fences if present
      const cleaned = rawContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      assistResponse = JSON.parse(cleaned)
    } catch {
      // If parsing fails, return raw content with a fallback structure
      assistResponse = {
        summary: rawContent,
        possibleCauses: [],
        steps: [],
        followUpQuestions: [],
        confidence: 'low',
      }
    }

    // Log usage to helen_assist_log via admin client (bypasses RLS)
    const adminClient = createAdminClient()
    await adminClient.from('helen_assist_log').insert({
      ticket_id: ticketId,
      org_id: user.orgId,
      user_id: user.id,
      model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      request_summary: requestSummary,
      response_body: rawContent,
      category_id: ticketContext.categoryId || null,
    })

    return NextResponse.json({
      assistResponse,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    })
  } catch (err) {
    console.error('Helpdesk assist error:', err)
    return NextResponse.json({ error: 'Failed to generate diagnostic' }, { status: 500 })
  }
}
