'use server'

import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { GraphClient } from '@/lib/email/graph-client'
import type { TeamsNotificationSettings } from './types'

// ── Read all Teams settings ───────────────────────────────────────────────────
export async function getTeamsSettings(): Promise<TeamsNotificationSettings> {
  const user = await requireAuth()
  const admin = createAdminClient()

  const { data } = await admin
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', user.orgId)
    .in('setting_key', [
      'teams_notifications_enabled', 'teams_team_id', 'teams_channel_id',
      'teams_webhook_url', 'teams_notify_job_assigned',
      'teams_notify_job_rescheduled', 'teams_notify_job_cancelled',
    ])

  const map = Object.fromEntries((data ?? []).map((r: { setting_key: string; setting_value: string }) => [r.setting_key, r.setting_value]))
  return {
    enabled: map.teams_notifications_enabled === 'true',
    teamId: map.teams_team_id ?? null,
    channelId: map.teams_channel_id ?? null,
    webhookUrl: map.teams_webhook_url ?? null,
    notifyJobAssigned: map.teams_notify_job_assigned !== 'false',
    notifyJobRescheduled: map.teams_notify_job_rescheduled !== 'false',
    notifyJobCancelled: map.teams_notify_job_cancelled !== 'false',
  }
}

// ── Save Teams settings ────────────────────────────────────────────────────────
export async function saveTeamsSettings(settings: Partial<TeamsNotificationSettings>): Promise<{ error?: string }> {
  const user = await requireAuth()
  if (!['admin', 'super_admin'].includes(user.role.name)) throw new Error('Forbidden')

  const admin = createAdminClient()
  const keyMap: Record<string, string> = {
    enabled: 'teams_notifications_enabled',
    teamId: 'teams_team_id',
    channelId: 'teams_channel_id',
    webhookUrl: 'teams_webhook_url',
    notifyJobAssigned: 'teams_notify_job_assigned',
    notifyJobRescheduled: 'teams_notify_job_rescheduled',
    notifyJobCancelled: 'teams_notify_job_cancelled',
  }

  for (const [jsKey, dbKey] of Object.entries(keyMap)) {
    if (jsKey in settings) {
      const value = String((settings as Record<string, unknown>)[jsKey] ?? '')
      await admin.from('org_settings').upsert(
        {
          org_id: user.orgId,
          category: 'teams',
          setting_key: dbKey,
          setting_value: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,setting_key' }
      )
    }
  }

  return {}
}

// ── List teams (for settings picker) ─────────────────────────────────────────
export async function listTeams(): Promise<{ id: string; displayName: string }[]> {
  await requireAuth()
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('mail_connections')
    .select('tenant_id, client_id, client_secret')
    .limit(1).single()
  if (!conn) return []

  const client = new GraphClient(conn)
  return client.listJoinedTeams()
}

// ── List channels in a team ───────────────────────────────────────────────────
export async function listChannels(teamId: string): Promise<{ id: string; displayName: string }[]> {
  await requireAuth()
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('mail_connections')
    .select('tenant_id, client_id, client_secret')
    .limit(1).single()
  if (!conn) return []

  const client = new GraphClient(conn)
  return client.listChannels(teamId)
}

// ── Send test message ─────────────────────────────────────────────────────────
export async function sendTeamsTestMessage(teamId: string, channelId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAuth()
    const admin = createAdminClient()
    const { data: conn } = await admin
      .from('mail_connections')
      .select('tenant_id, client_id, client_secret')
      .limit(1).single()
    if (!conn) return { ok: false, error: 'No Graph connection found' }

    const client = new GraphClient(conn)
    const ok = await client.sendChannelMessage(
      teamId,
      channelId,
      '<p><strong>✅ Engage Teams Integration</strong></p><p>Test message — connection is working correctly.</p>'
    )
    return { ok }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ── Get engineers with their Teams UPN ────────────────────────────────────────
export async function getEngineersForTeams(): Promise<{ id: string; full_name: string; email: string; teams_upn: string | null }[]> {
  const user = await requireAuth()
  const admin = createAdminClient()

  const { data } = await admin
    .from('users')
    .select('id, full_name, email, teams_upn')
    .eq('org_id', user.orgId)
    .in('role', ['tech', 'admin', 'super_admin'])
    .order('full_name')

  return data ?? []
}

// ── Update engineer Teams UPN ─────────────────────────────────────────────────
export async function updateEngineerUpn(userId: string, teamsUpn: string): Promise<{ error?: string }> {
  const user = await requireAuth()
  if (!['admin', 'super_admin'].includes(user.role.name)) throw new Error('Forbidden')

  const admin = createAdminClient()
  const { error } = await admin
    .from('users')
    .update({ teams_upn: teamsUpn || null })
    .eq('id', userId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  return {}
}
