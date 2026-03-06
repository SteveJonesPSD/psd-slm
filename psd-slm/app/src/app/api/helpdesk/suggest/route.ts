import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/lib/auth'

interface SuggestMessage {
  role: 'user' | 'assistant'
  content: string
}

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
  slaResponseDue: string | null
  slaResolutionDue: string | null
  assigneeName: string | null
  messages: {
    senderType: 'agent' | 'customer' | 'system'
    senderName: string | null
    body: string
    isInternal: boolean
    createdAt: string
  }[]
}

interface SuggestRequest {
  ticketContext: TicketContext
  messages: SuggestMessage[]
}

interface ApiUserWithPrefs extends AuthUser {
  aiPreferences: Record<string, string>
}

async function getApiUser(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ApiUserWithPrefs | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: appUser } = await supabase
    .from('users')
    .select('id, org_id, email, first_name, last_name, initials, color, avatar_url, must_change_password, role_id, ai_preferences, roles(id, name, display_name)')
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
    email: appUser.email,
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
    aiPreferences: (appUser.ai_preferences as Record<string, string>) || {},
  }
}

function buildSystemPrompt(
  context: TicketContext,
  globalSettings: Record<string, string>,
  userPreferences: Record<string, string>
): string {
  // Merge settings: user overrides > global > defaults
  const tone = userPreferences.tone_override || globalSettings.ai_suggest_tone || 'professional'
  const formality = userPreferences.formality_override || globalSettings.ai_suggest_formality || 'formal'
  const mentionSla = globalSettings.ai_suggest_mention_sla || 'when_relevant'
  const maxLength = globalSettings.ai_suggest_max_length || 'medium'
  const clarification = globalSettings.ai_suggest_clarification || 'ask_if_low_detail'
  const customInstructions = globalSettings.ai_suggest_custom_instructions || ''

  const toneLabels: Record<string, string> = {
    professional: 'professional and business-like',
    friendly: 'friendly and approachable',
    empathetic: 'empathetic and understanding',
  }
  const formalityLabels: Record<string, string> = {
    formal: 'formal',
    semi_formal: 'semi-formal',
    casual: 'casual and conversational',
  }
  const lengthLabels: Record<string, string> = {
    brief: 'Keep responses brief — 2-3 sentences maximum.',
    medium: 'Aim for 1-2 short paragraphs.',
    detailed: 'Provide detailed, thorough responses.',
  }

  const clarificationInstruction =
    clarification === 'always_draft'
      ? 'Always draft a suggested response immediately — do NOT ask the agent clarifying questions first. Just produce your best suggestion based on available context.'
      : clarification === 'never_ask'
        ? 'Always draft a suggested response. Never ask clarifying questions.'
        : 'If you have enough context, draft a suggested response. If the ticket has very little detail, you may ask the agent one or two brief clarifying questions first.'

  const slaInstruction =
    mentionSla === 'always'
      ? 'Always mention SLA deadlines in the response when SLA data is available.'
      : mentionSla === 'never'
        ? 'Do NOT mention SLA deadlines in customer-facing responses.'
        : 'Mention SLA deadlines only when they are relevant to the response (e.g. when setting expectations for resolution time).'

  const conversationHistory = context.messages
    .map((m) => {
      const label = m.isInternal ? `[INTERNAL NOTE]` : `[${m.senderType.toUpperCase()}]`
      const name = m.senderName || 'Unknown'
      const time = new Date(m.createdAt).toLocaleString('en-GB')
      return `${label} ${name} (${time}):\n${m.body}`
    })
    .join('\n\n---\n\n')

  let prompt = `You are a helpful assistant for PSD Group's helpdesk team. Your job is to help agents draft customer responses for support tickets.

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
${context.slaResponseDue ? `- **SLA Response Due:** ${new Date(context.slaResponseDue).toLocaleString('en-GB')}` : ''}
${context.slaResolutionDue ? `- **SLA Resolution Due:** ${new Date(context.slaResolutionDue).toLocaleString('en-GB')}` : ''}
${context.description ? `\n## Original Description\n${context.description}` : ''}

## Conversation History
${conversationHistory || 'No messages yet.'}

## Response Style
- Write in ${toneLabels[tone] || tone}, ${formalityLabels[formality] || formality} British English.
- ${lengthLabels[maxLength] || lengthLabels.medium}
- ${slaInstruction}

## Instructions
- ${clarificationInstruction}
- When you provide a suggested response, wrap it in delimiters like this:

[SUGGESTED RESPONSE]
Your suggested customer-facing text here...
[/SUGGESTED RESPONSE]

- Address the customer by their first name (derived from the contact name).
- NEVER include content from internal notes in the suggested response — those are private to the team.
- The agent can ask you to refine the suggestion (e.g. "make it more formal", "mention the SLA deadline", "add an apology").
- Each time you revise, wrap the new version in [SUGGESTED RESPONSE] delimiters again.`

  // Append org custom instructions
  if (customInstructions.trim()) {
    prompt += `\n\n## Additional Organisation Guidelines\n${customInstructions.trim()}`
  }

  // Append agent personal style
  const styleNotes = userPreferences.writing_style_notes || ''
  const signature = userPreferences.signature || ''
  const phrasesToUse = userPreferences.phrases_to_use || ''
  const phrasesToAvoid = userPreferences.phrases_to_avoid || ''

  const hasPersonalStyle = styleNotes || signature || phrasesToUse || phrasesToAvoid
  if (hasPersonalStyle) {
    prompt += `\n\n## Agent Personal Style`
    if (styleNotes) {
      prompt += `\nWriting style: ${styleNotes}`
    }
    if (phrasesToUse) {
      prompt += `\nPhrases to incorporate naturally: ${phrasesToUse}`
    }
    if (phrasesToAvoid) {
      prompt += `\nPhrases to NEVER use: ${phrasesToAvoid}`
    }
    if (signature) {
      prompt += `\nEnd every suggested response with this sign-off:\n${signature}`
    }
  }

  return prompt
}

function extractSuggestion(text: string): { hasSuggestion: boolean; suggestedResponse: string | null } {
  const match = text.match(/\[SUGGESTED RESPONSE\]\s*([\s\S]*?)\s*\[\/SUGGESTED RESPONSE\]/)
  if (match) {
    return { hasSuggestion: true, suggestedResponse: match[1].trim() }
  }
  return { hasSuggestion: false, suggestedResponse: null }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getApiUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
  }

  let body: SuggestRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { ticketContext, messages } = body
  if (!ticketContext || !messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Missing ticketContext or messages' }, { status: 400 })
  }

  try {
    // Fetch global AI suggest settings
    const { data: orgSettings } = await supabase
      .from('org_settings')
      .select('setting_key, setting_value')
      .eq('org_id', user.orgId)
      .eq('category', 'ai_suggest')

    const globalSettings: Record<string, string> = {}
    for (const s of orgSettings || []) {
      globalSettings[s.setting_key] = (s.setting_value as string) ?? ''
    }

    const client = new Anthropic({ apiKey })

    const anthropicMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: buildSystemPrompt(ticketContext, globalSettings, user.aiPreferences),
      messages: anthropicMessages,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const { hasSuggestion, suggestedResponse } = extractSuggestion(content)

    return NextResponse.json({
      message: {
        role: 'assistant',
        content,
        hasSuggestion,
        suggestedResponse,
      },
    })
  } catch (err) {
    console.error('Helpdesk suggest error:', err)
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 })
  }
}
