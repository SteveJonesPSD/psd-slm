import { GraphClient } from '@/lib/email/graph-client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TeamsJobNotification, TeamsNotificationSettings } from './types'

// ── Load settings from org_settings ──────────────────────────────────────────
async function getTeamsSettings(orgId: string): Promise<TeamsNotificationSettings | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('org_settings')
    .select('setting_key, setting_value')
    .eq('org_id', orgId)
    .in('setting_key', [
      'teams_notifications_enabled',
      'teams_team_id',
      'teams_channel_id',
      'teams_webhook_url',
      'teams_notify_job_assigned',
      'teams_notify_job_rescheduled',
      'teams_notify_job_cancelled',
    ])

  if (!data || data.length === 0) return null

  const map = Object.fromEntries(data.map((r: { setting_key: string; setting_value: string }) => [r.setting_key, r.setting_value]))
  if (map.teams_notifications_enabled !== 'true') return null

  return {
    enabled: true,
    teamId: map.teams_team_id ?? null,
    channelId: map.teams_channel_id ?? null,
    webhookUrl: map.teams_webhook_url ?? null,
    notifyJobAssigned: map.teams_notify_job_assigned !== 'false',
    notifyJobRescheduled: map.teams_notify_job_rescheduled !== 'false',
    notifyJobCancelled: map.teams_notify_job_cancelled !== 'false',
  }
}

// ── Build HTML message ───────────────────────────────────────────────────────
function buildMessageHtml(n: TeamsJobNotification): string {
  const eventLabel = {
    assigned: '🔧 New Job Assigned',
    rescheduled: '🔄 Job Rescheduled',
    cancelled: '❌ Job Cancelled',
  }[n.eventType]

  const mentionHtml = n.engineerUpn
    ? `<at>${n.engineerName}</at>`
    : `<strong>${n.engineerName}</strong>`

  const noteHtml = n.notes ? `<br><em>Notes: ${n.notes}</em>` : ''

  return `
<p><strong>${eventLabel}</strong></p>
<table>
  <tr><td><strong>Job</strong></td><td><a href="${n.engageUrl}">${n.jobRef}</a></td></tr>
  <tr><td><strong>Customer</strong></td><td>${n.customerName}</td></tr>
  <tr><td><strong>Site</strong></td><td>${n.siteAddress}</td></tr>
  <tr><td><strong>Date</strong></td><td>${n.scheduledDate}</td></tr>
  <tr><td><strong>Time</strong></td><td>${n.scheduledTime}</td></tr>
  <tr><td><strong>Engineer</strong></td><td>${mentionHtml}</td></tr>
</table>${noteHtml}
<p><em style="color:#6b7280;font-size:12px;">Replies here are not monitored — update the job in <a href="${n.engageUrl}">Engage</a>.</em></p>
`.trim()
}

// ── Build mentions array for Graph API ───────────────────────────────────────
async function buildMentions(
  n: TeamsJobNotification,
  client: GraphClient
): Promise<{ id: number; mentionText: string; mentioned: { user: { id: string; displayName: string } } }[]> {
  if (!n.engineerUpn) return []
  const userId = await client.getUserIdByUpn(n.engineerUpn)
  if (!userId) return []
  return [{
    id: 0,
    mentionText: n.engineerName,
    mentioned: { user: { id: userId, displayName: n.engineerName } },
  }]
}

// ── Main export: fire-and-forget ──────────────────────────────────────────────
export async function notifyTeamsJobEvent(
  orgId: string,
  notification: TeamsJobNotification
): Promise<void> {
  try {
    const settings = await getTeamsSettings(orgId)
    if (!settings) return

    const eventKey = `notifyJob${notification.eventType.charAt(0).toUpperCase() + notification.eventType.slice(1)}` as keyof TeamsNotificationSettings
    if (!settings[eventKey]) return

    if (!settings.teamId || !settings.channelId) return

    const supabase = createAdminClient()
    const { data: conn } = await supabase
      .from('mail_connections')
      .select('tenant_id, client_id, client_secret')
      .eq('org_id', orgId)
      .limit(1)
      .single()

    if (!conn) return

    const client = new GraphClient(conn)

    const mentions = await buildMentions(notification, client)
    const html = buildMessageHtml(notification)

    await client.sendChannelMessage(settings.teamId, settings.channelId, html, mentions)
  } catch (err) {
    console.error('[Teams] Notification failed:', err)
  }
}
