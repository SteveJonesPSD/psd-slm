// =============================================================================
// AI Scenario Engine
// Evaluates inbound emails against configured AI scenarios (first-match-wins).
// Called from the scenario mail handler for non-helpdesk channels.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { GraphClient } from './graph-client'
import type { ProcessedEmail, MailConnection } from './types'
import { handleHelpdeskEmail } from './handlers/helpdesk'
import type { AiScenario, ScenarioGuardrails } from '@/lib/ai-scenarios/types'
import { runToolCallingLoop, buildActionSystemPrompt } from '@/lib/ai-scenarios/tools'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ScenarioEngineParams {
  orgId: string
  channelId: string
  channelName: string
  mailboxAddress: string
  message: ProcessedEmail
  contact: { id: string; name: string; email: string; customer_name: string } | null
}

export async function runScenarioEngine(params: ScenarioEngineParams): Promise<void> {
  const { orgId, channelId, channelName, mailboxAddress, message, contact } = params
  const supabase = createAdminClient()

  const msg = message.graphMessage
  const senderEmail = msg.from?.emailAddress?.address?.toLowerCase() || ''
  const senderName = msg.from?.emailAddress?.name || senderEmail
  const subject = msg.subject || '(No subject)'
  const bodyText = msg.body.contentType === 'Text'
    ? msg.body.content || ''
    : stripHtml(msg.body.content || '')
  const emailPreview = bodyText.slice(0, 400)

  // Load active scenarios
  const { data: scenarios } = await supabase
    .from('ai_scenarios')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (!scenarios || scenarios.length === 0) return

  // First-match-wins evaluation
  for (const scenario of scenarios as AiScenario[]) {
    try {
      // Step A: MATCH (Haiku)
      const matchResult = await evaluateMatch(scenario, senderEmail, senderName, subject, bodyText)

      if (!matchResult.match) continue

      // Step B: GUARDRAILS
      const guardrails = scenario.guardrails as ScenarioGuardrails
      const guardrailBlock = await checkGuardrails(
        supabase, guardrails, orgId, senderEmail, scenario.id, contact
      )

      if (guardrailBlock) {
        await logExecution(supabase, {
          org_id: orgId,
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          agent_id: scenario.agent_id,
          channel_id: channelId,
          channel_name: channelName,
          mailbox_address: mailboxAddress,
          sender_email: senderEmail,
          sender_name: senderName,
          customer_name: contact?.customer_name || null,
          email_subject: subject,
          email_preview: emailPreview,
          email_message_id: msg.id,
          match_rationale: matchResult.rationale,
          status: 'guardrail_blocked',
          error_detail: guardrailBlock,
        })
        return // first match wins — blocked but still the matched scenario
      }

      // Step C: ACTION (Sonnet with tool-calling)
      const actionResult = await executeAction(scenario, senderEmail, senderName, subject, bodyText, contact, orgId)

      // Step D: DRY RUN CHECK
      if (guardrails.dry_run) {
        await logExecution(supabase, {
          org_id: orgId,
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          agent_id: scenario.agent_id,
          channel_id: channelId,
          channel_name: channelName,
          mailbox_address: mailboxAddress,
          sender_email: senderEmail,
          sender_name: senderName,
          customer_name: contact?.customer_name || null,
          email_subject: subject,
          email_preview: emailPreview,
          email_message_id: msg.id,
          match_rationale: matchResult.rationale,
          actions_taken: actionResult.actions_taken,
          response_subject: actionResult.subject,
          response_preview: actionResult.body_html?.slice(0, 600) || null,
          response_sent: false,
          dry_run: true,
          status: 'dry_run',
        })
        return
      }

      // Step E: SEND REPLY
      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
      const connection = await getConnectionForChannel(supabase, channelId)

      if (connection && actionResult.body_html) {
        const graphClient = new GraphClient(connection)
        await graphClient.sendMail(mailboxAddress, {
          to: [{ address: senderEmail, name: senderName }],
          subject: actionResult.subject || replySubject,
          bodyHtml: actionResult.body_html,
          inReplyTo: message.inReplyTo || undefined,
          references: message.references.length > 0 ? message.references : undefined,
        })
      }

      await logExecution(supabase, {
        org_id: orgId,
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        agent_id: scenario.agent_id,
        channel_id: channelId,
        channel_name: channelName,
        mailbox_address: mailboxAddress,
        sender_email: senderEmail,
        sender_name: senderName,
        customer_name: contact?.customer_name || null,
        email_subject: subject,
        email_preview: emailPreview,
        email_message_id: msg.id,
        match_rationale: matchResult.rationale,
        actions_taken: actionResult.actions_taken,
        response_subject: actionResult.subject || replySubject,
        response_preview: actionResult.body_html?.slice(0, 600) || null,
        response_sent: true,
        status: 'matched',
      })
      return // first match wins

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      const guardrails = scenario.guardrails as ScenarioGuardrails

      // Escalate to helpdesk if configured
      if (guardrails.escalate_to_helpdesk_on_failure) {
        try {
          const { data: channels } = await supabase
            .from('mail_channels')
            .select('*, mail_connections(*)')
            .eq('org_id', orgId)
            .eq('handler', 'helpdesk')
            .eq('is_active', true)
            .limit(1)

          if (channels && channels.length > 0) {
            await handleHelpdeskEmail(message, channels[0], orgId, supabase)
          }

          await logExecution(supabase, {
            org_id: orgId,
            scenario_id: scenario.id,
            scenario_name: scenario.name,
            agent_id: scenario.agent_id,
            channel_id: channelId,
            channel_name: channelName,
            mailbox_address: mailboxAddress,
            sender_email: senderEmail,
            sender_name: senderName,
            customer_name: contact?.customer_name || null,
            email_subject: subject,
            email_preview: emailPreview,
            email_message_id: msg.id,
            status: 'escalated',
            error_detail: `Escalated after error: ${errorMessage}`,
          })
          return
        } catch {
          // If escalation also fails, log as error
        }
      }

      await logExecution(supabase, {
        org_id: orgId,
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        agent_id: scenario.agent_id,
        channel_id: channelId,
        channel_name: channelName,
        mailbox_address: mailboxAddress,
        sender_email: senderEmail,
        sender_name: senderName,
        customer_name: contact?.customer_name || null,
        email_subject: subject,
        email_preview: emailPreview,
        email_message_id: msg.id,
        status: 'error',
        error_detail: errorMessage,
      })
      return // first match wins (even on error)
    }
  }

  // No match across all scenarios
  await logExecution(supabase, {
    org_id: orgId,
    scenario_id: null,
    scenario_name: 'No Match',
    agent_id: 'helen',
    channel_id: channelId,
    channel_name: channelName,
    mailbox_address: mailboxAddress,
    sender_email: senderEmail,
    sender_name: senderName,
    customer_name: contact?.customer_name || null,
    email_subject: subject,
    email_preview: emailPreview,
    email_message_id: msg.id,
    status: 'no_match',
  })
}

// =============================================================================
// Match evaluation
// =============================================================================

async function evaluateMatch(
  scenario: AiScenario,
  senderEmail: string,
  senderName: string,
  subject: string,
  bodyText: string
): Promise<{ match: boolean; rationale: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: 'You are an email classifier. Reply with ONLY a JSON object: {"match": true|false, "rationale": "...one sentence..."}',
    messages: [
      {
        role: 'user',
        content: `Scenario trigger: "${scenario.trigger_prompt}"

Email to classify:
From: ${senderName} <${senderEmail}>
Subject: ${subject}
Body: ${bodyText.slice(0, 1000)}

Does this email match the scenario trigger? Reply JSON only.`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {
    // Fall through
  }
  return { match: false, rationale: 'Failed to parse match response' }
}

// =============================================================================
// Guardrail checks
// =============================================================================

async function checkGuardrails(
  supabase: ReturnType<typeof createAdminClient>,
  guardrails: ScenarioGuardrails,
  orgId: string,
  senderEmail: string,
  scenarioId: string,
  contact: ScenarioEngineParams['contact']
): Promise<string | null> {
  // Known contacts only
  if (guardrails.known_contacts_only && !contact) {
    return 'Sender is not a known contact'
  }

  // Rate limit per sender per day
  if (guardrails.max_per_sender_per_day > 0) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('ai_scenario_executions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('sender_email', senderEmail)
      .eq('scenario_id', scenarioId)
      .gte('executed_at', dayAgo)
      .in('status', ['matched', 'dry_run'])

    if ((count || 0) >= guardrails.max_per_sender_per_day) {
      return `Rate limit exceeded: ${count} of ${guardrails.max_per_sender_per_day} per day`
    }
  }

  // Business hours only
  if (guardrails.business_hours_only) {
    const now = new Date()
    const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }))
    const day = ukTime.getDay() // 0=Sun, 6=Sat
    const hour = ukTime.getHours()

    if (day === 0 || day === 6 || hour < 8 || hour >= 18) {
      return 'Outside business hours (Mon-Fri 08:00-18:00 UK)'
    }
  }

  return null
}

// =============================================================================
// Action execution
// =============================================================================

async function executeAction(
  scenario: AiScenario,
  senderEmail: string,
  senderName: string,
  subject: string,
  bodyText: string,
  contact: ScenarioEngineParams['contact'],
  orgId: string
): Promise<{ subject: string | null; body_html: string | null; actions_taken: Record<string, unknown>[] }> {
  const supabase = createAdminClient()

  const systemPrompt = buildActionSystemPrompt(scenario.agent_id, scenario.action_prompt)

  const customerContext = contact
    ? `\nCustomer: ${contact.customer_name}\nContact: ${contact.name} (${contact.email})`
    : '\nCustomer: Unknown'

  const userMessage = `Inbound email:
From: ${senderName} <${senderEmail}>
Subject: ${subject}
${customerContext}

Body:
${bodyText}`

  return runToolCallingLoop({
    anthropic,
    supabase,
    systemPrompt,
    userMessage,
    ctx: {
      orgId,
      customerName: contact?.customer_name || null,
      contactName: contact?.name || null,
      contactEmail: contact?.email || null,
    },
  })
}

// buildActionSystemPrompt imported from @/lib/ai-scenarios/tools

// =============================================================================
// Helpers
// =============================================================================

async function getConnectionForChannel(
  supabase: ReturnType<typeof createAdminClient>,
  channelId: string
): Promise<MailConnection | null> {
  const { data } = await supabase
    .from('mail_channels')
    .select('connection_id, mail_connections(*)')
    .eq('id', channelId)
    .single()

  if (!data?.mail_connections) return null
  return data.mail_connections as unknown as MailConnection
}

async function logExecution(
  supabase: ReturnType<typeof createAdminClient>,
  entry: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('ai_scenario_executions').insert(entry)
  } catch (err) {
    console.error('[ScenarioEngine] Failed to log execution:', err)
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}
