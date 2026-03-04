/**
 * Helen AI Agent — Helpdesk triage pipeline
 *
 * Called fire-and-forget after ticket creation. Uses the admin client
 * (service-role) because the cookie-based client loses auth context
 * once the HTTP response completes.
 *
 * Pipeline:
 *  1. Check helen_enabled kill switch
 *  2. Fetch ticket details
 *  3. Send acknowledgement (if helen_ack_enabled)
 *  4. Call Claude for triage + draft (if helen_draft_enabled)
 *  5. Process tags (existing + new if helen_create_tags)
 *  6. Execute automation macros
 *  7. Create draft response (pending or auto_sent for needs_detail)
 *  8. Notify assigned agent / watchers
 *  9. Log to triage_log
 */

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeMacros } from './macros'
import { createNotification } from '@/lib/notifications'
import type { TicketTag } from '@/types/database'

// ============================================================================
// ACKNOWLEDGEMENT PLACEHOLDERS
// ============================================================================

const DEFAULT_ACK_TEMPLATE = `Hi {contact_name},

Thank you for contacting PSD Group support. Your ticket {ticket_number} has been logged and our team will be in touch shortly.

Subject: {subject}
Priority: {priority}
Reference: {ticket_number}

Regards,
PSD Support`

function substituteAckPlaceholders(
  template: string,
  vars: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value)
  }
  return result
}

// ============================================================================
// SETTINGS HELPERS
// ============================================================================

type HelenSettings = Record<string, string>

async function fetchHelenSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string
): Promise<HelenSettings> {
  const { data } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .eq('category', 'helen')

  const settings: HelenSettings = {}
  for (const row of data || []) {
    settings[row.setting_key] = String(row.setting_value ?? '')
  }
  return settings
}

// ============================================================================
// AI SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPrompt(
  persona: string,
  guardrails: string,
  tagNames: string[]
): string {
  return `You are Helen, an AI helpdesk triage assistant for an IT managed services provider.

${persona ? `PERSONA:\n${persona}\n` : ''}
${guardrails ? `GUARDRAILS:\n${guardrails}\n` : ''}
TASK: Analyse the support ticket below and return a JSON response.

Available tags (only assign from this list or suggest new ones): ${JSON.stringify(tagNames)}

Respond with JSON only — no markdown fencing or commentary:
{
  "tags": ["ExistingTag1", "ExistingTag2"],
  "new_tags": ["SuggestedNewTag"],
  "needs_detail": false,
  "missing_info": [],
  "reasoning": "Brief explanation of your analysis",
  "draft_response": "A professional, helpful response to send to the customer"
}

Rules:
- "tags": assign existing tags from the available list that clearly apply
- "new_tags": suggest new tag names ONLY if nothing in the available list fits AND the ticket warrants a distinct category (max 3). Leave empty otherwise
- "needs_detail": set to true if the ticket lacks key information needed to diagnose/resolve
- "missing_info": if needs_detail is true, list the specific missing pieces of information
- "reasoning": brief internal explanation of your analysis (not shown to customer)
- "draft_response": a professional customer-facing response that:
  - Acknowledges the issue
  - If needs_detail is true, politely requests the missing information
  - If needs_detail is false, provides initial guidance or sets expectations
  - Uses a warm but professional tone
  - Does NOT promise specific timelines or outcomes
  - Does NOT make up technical details you don't know`
}

// ============================================================================
// AI RESPONSE TYPE
// ============================================================================

interface TriageAIResponse {
  tags: string[]
  new_tags: string[]
  needs_detail: boolean
  missing_info: string[]
  reasoning: string
  draft_response: string
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

export async function triageTicket(
  ticketId: string,
  orgId: string,
  existingTagIds: string[]
): Promise<void> {
  const startTime = Date.now()
  const supabase = createAdminClient()

  let ackSent = false
  let draftId: string | null = null
  let draftType: string | null = null
  let tagsCreated: string[] = []
  let autoSent = false

  try {
    // ================================================================
    // 1. Check Helen kill switch
    // ================================================================
    const settings = await fetchHelenSettings(supabase, orgId)

    if (settings.helen_enabled !== 'true') return

    // ================================================================
    // 2. Fetch ticket details
    // ================================================================
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select(`
        id, ticket_number, subject, description, priority, status,
        sla_response_due_at,
        customers(name),
        contacts(first_name, last_name),
        ticket_categories(name),
        assigned_to
      `)
      .eq('id', ticketId)
      .single()

    if (ticketErr || !ticket) {
      throw new Error(`Failed to fetch ticket: ${ticketErr?.message || 'not found'}`)
    }

    const customers = ticket.customers as unknown as { name: string } | { name: string }[] | null
    const customerName = Array.isArray(customers) ? customers[0]?.name : customers?.name || 'Unknown'
    const contacts = ticket.contacts as unknown as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    const contact = Array.isArray(contacts) ? contacts[0] : contacts
    const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'there'
    const categories = ticket.ticket_categories as unknown as { name: string } | { name: string }[] | null
    const categoryName = Array.isArray(categories) ? categories[0]?.name : categories?.name || 'Uncategorised'

    // ================================================================
    // 3. Send acknowledgement (if enabled)
    // ================================================================
    if (settings.helen_ack_enabled === 'true') {
      const template = settings.helen_ack_template || DEFAULT_ACK_TEMPLATE
      const ackBody = substituteAckPlaceholders(template, {
        ticket_number: ticket.ticket_number,
        customer_name: customerName,
        contact_name: contactName,
        subject: ticket.subject,
        priority: ticket.priority,
        category: categoryName,
        sla_response_due: ticket.sla_response_due_at
          ? new Date(ticket.sla_response_due_at).toLocaleString('en-GB')
          : 'N/A',
      })

      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_type: 'agent',
        sender_id: null,
        sender_name: 'Helen (AI Assistant)',
        body: ackBody,
        is_internal: false,
      })

      ackSent = true
    }

    // ================================================================
    // 4. Fetch AI-assignable tags
    // ================================================================
    const { data: aiTags } = await supabase
      .from('ticket_tags')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_ai_assignable', true)
      .eq('is_active', true)

    const tagNames = ((aiTags || []) as TicketTag[]).map((t) => t.name)

    // ================================================================
    // 5. Call Claude for triage + draft (if draft enabled)
    // ================================================================
    let aiResult: TriageAIResponse | null = null
    let reasoning = ''

    if (settings.helen_draft_enabled === 'true' || tagNames.length > 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured')
      }

      const persona = settings.helen_persona || ''
      const guardrails = settings.helen_guardrails || ''
      const systemPrompt = buildSystemPrompt(persona, guardrails, tagNames)

      const userMessage = [
        `Subject: ${ticket.subject}`,
        ticket.description ? `Description: ${ticket.description}` : null,
        `Priority: ${ticket.priority}`,
        `Customer: ${customerName}`,
        `Contact: ${contactName}`,
        `Category: ${categoryName}`,
      ]
        .filter(Boolean)
        .join('\n')

      const client = new Anthropic({ apiKey })
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      const textBlock = response.content.find((block) => block.type === 'text')
      if (!textBlock?.text) {
        throw new Error('No text in AI response')
      }

      // Parse response
      let jsonStr = textBlock.text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      aiResult = JSON.parse(jsonStr) as TriageAIResponse
      reasoning = aiResult.reasoning || ''
    }

    // ================================================================
    // 6. Process tags
    // ================================================================
    const tagMap = new Map(((aiTags || []) as TicketTag[]).map((t) => [t.name.toLowerCase(), t.id]))
    let newTagIds: string[] = []

    if (aiResult) {
      // Map existing tag names to IDs
      newTagIds = (aiResult.tags || [])
        .map((name) => tagMap.get(name.toLowerCase()))
        .filter((id): id is string => !!id && !existingTagIds.includes(id))

      // Create new tags if allowed
      if (settings.helen_create_tags === 'true' && aiResult.new_tags && aiResult.new_tags.length > 0) {
        const tagsToCreate = aiResult.new_tags.slice(0, 3) // max 3

        for (const tagName of tagsToCreate) {
          // Don't create if it already exists
          if (tagMap.has(tagName.toLowerCase())) continue

          const { data: newTag } = await supabase
            .from('ticket_tags')
            .insert({
              org_id: orgId,
              name: tagName,
              color: '#8b5cf6', // violet
              is_ai_assignable: true,
              is_active: true,
            })
            .select('id')
            .single()

          if (newTag) {
            newTagIds.push(newTag.id)
            tagsCreated.push(newTag.id)
          }
        }
      }

      // Insert tag assignments
      if (newTagIds.length > 0) {
        await supabase.from('ticket_tag_assignments').insert(
          newTagIds.map((tagId) => ({ ticket_id: ticketId, tag_id: tagId }))
        )
      }
    }

    // ================================================================
    // 7. Execute automation macros
    // ================================================================
    const allTagIds = [...existingTagIds, ...newTagIds]
    const executedMacroIds = await executeMacros(
      supabase,
      ticketId,
      orgId,
      allTagIds,
      ticket.priority,
      ticket.status
    )

    // ================================================================
    // 8. Create draft response (if AI returned one)
    // ================================================================
    if (aiResult?.draft_response && settings.helen_draft_enabled === 'true') {
      const isNeedsDetail = aiResult.needs_detail === true
      draftType = isNeedsDetail ? 'needs_detail' : 'triage_response'

      const shouldAutoSend =
        isNeedsDetail && settings.helen_auto_send_needs_detail === 'true'

      const draftStatus = shouldAutoSend ? 'auto_sent' : 'pending'

      // Insert draft
      const { data: draft } = await supabase
        .from('helen_draft_responses')
        .insert({
          ticket_id: ticketId,
          org_id: orgId,
          draft_type: draftType,
          body: aiResult.draft_response,
          status: draftStatus,
          ai_reasoning: reasoning,
        })
        .select('id')
        .single()

      if (draft) {
        draftId = draft.id

        if (shouldAutoSend) {
          // Auto-send: create real ticket message
          const { data: msg } = await supabase
            .from('ticket_messages')
            .insert({
              ticket_id: ticketId,
              sender_type: 'agent',
              sender_id: null,
              sender_name: 'Helen (AI Assistant)',
              body: aiResult.draft_response,
              is_internal: false,
            })
            .select('id')
            .single()

          if (msg) {
            // Link draft to message
            await supabase
              .from('helen_draft_responses')
              .update({ message_id: msg.id, updated_at: new Date().toISOString() })
              .eq('id', draft.id)

            // Track SLA first response
            const { data: currentTicket } = await supabase
              .from('tickets')
              .select('first_responded_at')
              .eq('id', ticketId)
              .single()

            const updates: Record<string, unknown> = {
              status: 'waiting_on_customer',
              waiting_since: new Date().toISOString(),
              auto_close_warning_sent_at: null,
              updated_at: new Date().toISOString(),
            }

            if (!currentTicket?.first_responded_at) {
              updates.first_responded_at = new Date().toISOString()
            }

            await supabase
              .from('tickets')
              .update(updates)
              .eq('id', ticketId)
          }

          autoSent = true
        }
      }
    }

    // ================================================================
    // 9. Notify assigned agent if draft is pending
    // ================================================================
    if (draftId && !autoSent) {
      // Notify assigned agent
      if (ticket.assigned_to) {
        createNotification({
          supabase,
          orgId,
          userId: ticket.assigned_to,
          type: 'helen_draft_ready',
          title: 'Helen AI — Draft Response Ready',
          message: `${ticket.ticket_number}: ${ticket.subject}`,
          link: `/helpdesk/tickets/${ticketId}`,
          entityType: 'ticket',
          entityId: ticketId,
        })
      }

      // Notify watchers
      const { data: watchers } = await supabase
        .from('ticket_watchers')
        .select('user_id')
        .eq('ticket_id', ticketId)

      for (const w of watchers || []) {
        if (w.user_id !== ticket.assigned_to) {
          createNotification({
            supabase,
            orgId,
            userId: w.user_id,
            type: 'helen_draft_ready',
            title: 'Helen AI — Draft Response Ready',
            message: `${ticket.ticket_number}: ${ticket.subject}`,
            link: `/helpdesk/tickets/${ticketId}`,
            entityType: 'ticket',
            entityId: ticketId,
          })
        }
      }
    }

    // ================================================================
    // 10. Log to triage_log
    // ================================================================
    await supabase.from('triage_log').insert({
      ticket_id: ticketId,
      org_id: orgId,
      tags_assigned: newTagIds,
      tags_existing: existingTagIds,
      ai_reasoning: reasoning,
      macros_executed: executedMacroIds,
      processing_time_ms: Date.now() - startTime,
      ack_sent: ackSent,
      draft_id: draftId,
      draft_type: draftType,
      tags_created: tagsCreated,
      auto_sent: autoSent,
    })

    console.log(
      `[helen] Ticket ${ticketId}: ack=${ackSent}, tags=${newTagIds.length} (${tagsCreated.length} new), macros=${executedMacroIds.length}, draft=${draftType || 'none'}${autoSent ? ' (auto-sent)' : ''} in ${Date.now() - startTime}ms`
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[helen] Error processing ticket ${ticketId}:`, message)

    // Log error to triage_log
    await supabase
      .from('triage_log')
      .insert({
        ticket_id: ticketId,
        org_id: orgId,
        tags_existing: existingTagIds,
        error: message,
        processing_time_ms: Date.now() - startTime,
        ack_sent: ackSent,
        draft_id: draftId,
        draft_type: draftType,
        tags_created: tagsCreated,
        auto_sent: autoSent,
      })
      .then(() => {})
  }
}
