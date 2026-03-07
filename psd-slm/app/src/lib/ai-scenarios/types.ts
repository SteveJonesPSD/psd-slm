export type AgentId = 'helen' | 'jasper' | 'lucia'

export type ScenarioStatus =
  | 'matched'
  | 'dry_run'
  | 'no_match'
  | 'guardrail_blocked'
  | 'escalated'
  | 'error'

export interface ScenarioGuardrails {
  known_contacts_only: boolean
  max_per_sender_per_day: number
  business_hours_only: boolean
  dry_run: boolean
  escalate_to_helpdesk_on_failure: boolean
}

export interface AiScenario {
  id: string
  org_id: string
  name: string
  description: string | null
  agent_id: AgentId
  trigger_prompt: string
  action_prompt: string
  guardrails: ScenarioGuardrails
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AiScenarioExecution {
  id: string
  org_id: string
  scenario_id: string | null
  scenario_name: string
  agent_id: AgentId
  channel_id: string | null
  channel_name: string | null
  mailbox_address: string | null
  sender_email: string
  sender_name: string | null
  customer_name: string | null
  email_subject: string
  email_preview: string | null
  email_message_id: string | null
  match_rationale: string | null
  actions_taken: Record<string, unknown>[] | null
  response_subject: string | null
  response_preview: string | null
  response_sent: boolean
  dry_run: boolean
  status: ScenarioStatus
  error_detail: string | null
  executed_at: string
}

export interface DryRunResult {
  would_match: boolean
  scenario_name: string
  agent_id: AgentId
  match_rationale: string
  simulated_response_preview: string | null
  guardrail_notes: string[]
}

export const DEFAULT_GUARDRAILS: ScenarioGuardrails = {
  known_contacts_only: true,
  max_per_sender_per_day: 5,
  business_hours_only: false,
  dry_run: false,
  escalate_to_helpdesk_on_failure: true,
}

export const AGENT_CONFIG: Record<AgentId, { label: string; description: string; color: string; bg: string; darkBg: string }> = {
  helen: { label: 'Helen', description: 'Service Desk', color: '#0d9488', bg: '#f0fdfa', darkBg: 'rgba(13,148,136,0.15)' },
  jasper: { label: 'Jasper', description: 'Sales', color: '#2563eb', bg: '#eff6ff', darkBg: 'rgba(37,99,235,0.15)' },
  lucia: { label: 'Lucia', description: 'Operations', color: '#7c3aed', bg: '#f5f3ff', darkBg: 'rgba(124,58,237,0.15)' },
}

export const STATUS_CONFIG: Record<ScenarioStatus, { label: string; color: string; bg: string; darkBg: string }> = {
  matched: { label: 'Matched', color: '#059669', bg: '#ecfdf5', darkBg: 'rgba(5,150,105,0.15)' },
  dry_run: { label: 'Dry Run', color: '#2563eb', bg: '#eff6ff', darkBg: 'rgba(37,99,235,0.15)' },
  no_match: { label: 'No Match', color: '#6b7280', bg: '#f3f4f6', darkBg: 'rgba(107,114,128,0.15)' },
  guardrail_blocked: { label: 'Blocked', color: '#d97706', bg: '#fffbeb', darkBg: 'rgba(217,119,6,0.15)' },
  escalated: { label: 'Escalated', color: '#ea580c', bg: '#fff7ed', darkBg: 'rgba(234,88,12,0.15)' },
  error: { label: 'Error', color: '#dc2626', bg: '#fef2f2', darkBg: 'rgba(220,38,38,0.15)' },
}
