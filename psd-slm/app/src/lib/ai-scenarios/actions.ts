'use server'

import { requirePermission } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  AiScenario,
  AiScenarioExecution,
  AgentId,
  ScenarioGuardrails,
  ScenarioStatus,
  DryRunResult,
} from './types'
import { DEFAULT_GUARDRAILS } from './types'
import Anthropic from '@anthropic-ai/sdk'
import { GraphClient } from '@/lib/email/graph-client'
import type { MailConnection } from '@/lib/email/types'
import { runToolCallingLoop, buildActionSystemPrompt } from './tools'

// =============================================================================
// Scenario CRUD
// =============================================================================

export async function getScenarios(): Promise<AiScenario[]> {
  const user = await requirePermission('settings', 'view')
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('ai_scenarios')
    .select('*')
    .eq('org_id', user.orgId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch scenarios: ${error.message}`)
  return (data || []) as AiScenario[]
}

export async function saveScenario(
  input: Partial<AiScenario> & {
    name: string
    agent_id: AgentId
    trigger_prompt: string
    action_prompt: string
  }
): Promise<AiScenario> {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = createAdminClient()

  if (!input.name.trim()) throw new Error('Name is required')
  if (!input.trigger_prompt.trim()) throw new Error('Trigger prompt is required')
  if (!input.action_prompt.trim()) throw new Error('Action prompt is required')

  const record = {
    org_id: user.orgId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    agent_id: input.agent_id,
    trigger_prompt: input.trigger_prompt.trim(),
    action_prompt: input.action_prompt.trim(),
    guardrails: input.guardrails || DEFAULT_GUARDRAILS,
    priority: input.priority ?? 10,
    is_active: input.is_active ?? true,
  }

  if (input.id) {
    // Update
    const { data, error } = await supabase
      .from('ai_scenarios')
      .update(record)
      .eq('id', input.id)
      .eq('org_id', user.orgId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update scenario: ${error.message}`)
    return data as AiScenario
  } else {
    // Insert
    const { data, error } = await supabase
      .from('ai_scenarios')
      .insert(record)
      .select()
      .single()

    if (error) throw new Error(`Failed to create scenario: ${error.message}`)
    return data as AiScenario
  }
}

export async function deleteScenario(id: string): Promise<void> {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('ai_scenarios')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) throw new Error(`Failed to delete scenario: ${error.message}`)
}

export async function toggleScenarioActive(id: string, is_active: boolean): Promise<void> {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('ai_scenarios')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) throw new Error(`Failed to toggle scenario: ${error.message}`)
}

export async function updateScenarioPriority(id: string, priority: number): Promise<void> {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('ai_scenarios')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.orgId)

  if (error) throw new Error(`Failed to update priority: ${error.message}`)
}

// =============================================================================
// Execution Log
// =============================================================================

export async function getExecutionLog(options?: {
  scenarioId?: string
  status?: ScenarioStatus
  limit?: number
}): Promise<AiScenarioExecution[]> {
  const user = await requirePermission('settings', 'view')
  const supabase = createAdminClient()

  let query = supabase
    .from('ai_scenario_executions')
    .select('*')
    .eq('org_id', user.orgId)
    .order('executed_at', { ascending: false })
    .limit(options?.limit ?? 200)

  if (options?.scenarioId) {
    query = query.eq('scenario_id', options.scenarioId)
  }
  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch execution log: ${error.message}`)
  return (data || []) as AiScenarioExecution[]
}

export async function clearExecutionLog(): Promise<void> {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('ai_scenario_executions')
    .delete()
    .eq('org_id', user.orgId)

  if (error) throw new Error(`Failed to clear execution log: ${error.message}`)
}

export async function getExecutionStats(): Promise<{
  total: number
  matched: number
  dry_run: number
  no_match: number
  guardrail_blocked: number
  escalated: number
  error: number
  last_24h: number
}> {
  const user = await requirePermission('settings', 'view')
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('ai_scenario_executions')
    .select('status, executed_at')
    .eq('org_id', user.orgId)

  if (error) throw new Error(`Failed to fetch execution stats: ${error.message}`)

  const rows = data || []
  const now = Date.now()
  const dayAgo = now - 24 * 60 * 60 * 1000

  const stats = {
    total: rows.length,
    matched: 0,
    dry_run: 0,
    no_match: 0,
    guardrail_blocked: 0,
    escalated: 0,
    error: 0,
    last_24h: 0,
  }

  for (const row of rows) {
    const status = row.status as ScenarioStatus
    if (status in stats) {
      (stats as Record<string, number>)[status]++
    }
    if (new Date(row.executed_at).getTime() > dayAgo) {
      stats.last_24h++
    }
  }

  return stats
}

// =============================================================================
// Dry Run / Test Match
// =============================================================================

export async function testScenarioMatch(params: {
  trigger_prompt: string
  action_prompt: string
  agent_id: AgentId
  guardrails: ScenarioGuardrails
  sample_email: {
    subject: string
    body: string
    sender_email: string
    sender_name: string
  }
}): Promise<DryRunResult> {
  await requirePermission('settings', 'edit_all')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Step 1: Match using Haiku
  const matchResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: 'You are an email classifier. Reply with ONLY a JSON object: {"match": true|false, "rationale": "...one sentence..."}',
    messages: [
      {
        role: 'user',
        content: `Scenario trigger: "${params.trigger_prompt}"

Email to classify:
From: ${params.sample_email.sender_name} <${params.sample_email.sender_email}>
Subject: ${params.sample_email.subject}
Body: ${params.sample_email.body.slice(0, 1000)}

Does this email match the scenario trigger? Reply JSON only.`,
      },
    ],
  })

  const matchText = matchResponse.content[0]?.type === 'text' ? matchResponse.content[0].text : ''
  let matchResult = { match: false, rationale: 'Failed to parse match response' }
  try {
    const jsonMatch = matchText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      matchResult = JSON.parse(jsonMatch[0])
    }
  } catch {
    // Use default
  }

  const guardrailNotes: string[] = []

  // Check guardrails
  if (params.guardrails.business_hours_only) {
    const now = new Date()
    const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }))
    const ukHour = ukTime.getHours()
    const ukDay = ukTime.getDay() // 0=Sun, 6=Sat
    if (ukDay === 0 || ukDay === 6 || ukHour < 8 || ukHour >= 18) {
      guardrailNotes.push('Business hours guardrail would block this (currently outside Mon-Fri 08:00-18:00 UK time)')
    }
  }

  if (params.guardrails.dry_run) {
    guardrailNotes.push('Dry run mode is enabled — email would be logged but not sent')
  }

  if (!matchResult.match) {
    return {
      would_match: false,
      scenario_name: 'Test',
      agent_id: params.agent_id,
      match_rationale: matchResult.rationale,
      simulated_response_preview: null,
      guardrail_notes: guardrailNotes,
    }
  }

  // Step 2: Simulate action using Sonnet (no tools, just a preview)
  const actionResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: `You are simulating an AI agent response to an inbound email. Describe what actions you would take and draft a brief reply preview. Do NOT perform any actual actions. This is a simulation only.`,
    messages: [
      {
        role: 'user',
        content: `Action instructions: ${params.action_prompt}

Inbound email:
From: ${params.sample_email.sender_name} <${params.sample_email.sender_email}>
Subject: ${params.sample_email.subject}
Body: ${params.sample_email.body}

Describe what you would do and draft a sample reply.`,
      },
    ],
  })

  const actionText = actionResponse.content[0]?.type === 'text' ? actionResponse.content[0].text : ''

  return {
    would_match: true,
    scenario_name: 'Test',
    agent_id: params.agent_id,
    match_rationale: matchResult.rationale,
    simulated_response_preview: actionText,
    guardrail_notes: guardrailNotes,
  }
}

// =============================================================================
// Send Test Email
// =============================================================================

export async function sendTestEmail(params: {
  subject: string
  action_prompt: string
  agent_id: AgentId
  sample_email: {
    subject: string
    body: string
    sender_email: string
    sender_name: string
  }
}): Promise<{ success: boolean; error?: string; sentTo?: string; sentFrom?: string }> {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = createAdminClient()

  // Find an active mail connection + channel to send from
  const { data: channels } = await supabase
    .from('mail_channels')
    .select('*, mail_connections(*)')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .limit(1)

  if (!channels || channels.length === 0) {
    return { success: false, error: 'No active mail channel configured. Set one up in Settings → Email Integration.' }
  }

  const channel = channels[0]
  const connection = channel.mail_connections as unknown as MailConnection

  if (!connection || !connection.is_active) {
    return { success: false, error: 'Mail connection is not active.' }
  }

  // Generate a real response using tool-calling loop (same as live engine)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = buildActionSystemPrompt(params.agent_id, params.action_prompt)

  const userMessage = `Inbound email:
From: ${params.sample_email.sender_name} <${params.sample_email.sender_email}>
Subject: ${params.sample_email.subject}

Body:
${params.sample_email.body}`

  const actionResult = await runToolCallingLoop({
    anthropic,
    supabase,
    systemPrompt,
    userMessage,
    ctx: {
      orgId: user.orgId,
      customerName: null,
      contactName: params.sample_email.sender_name || null,
      contactEmail: params.sample_email.sender_email || null,
    },
  })

  const replyHtml = actionResult.body_html || '<p>No response generated.</p>'
  const replySubject = actionResult.subject || params.subject

  try {
    const client = new GraphClient(connection)

    const wrappedHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background: #7c3aed; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; font-size: 13px;">
          AI Scenario Engine — Test Email
        </div>
        <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; padding: 20px;">
          ${replyHtml}
        </div>
        <p style="color: #94a3b8; font-size: 11px; margin-top: 12px;">
          This is a test email sent from Innov8iv Engage AI Scenario Engine. No customer was contacted.
        </p>
      </div>
    `

    await client.sendMail(channel.mailbox_address, {
      to: [{ address: user.email, name: `${user.firstName} ${user.lastName}` }],
      subject: `[TEST] ${replySubject}`,
      bodyHtml: wrappedHtml,
    })

    return { success: true, sentTo: user.email, sentFrom: channel.mailbox_address }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to send: ${msg}` }
  }
}
