import { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUser, userWantsPush } from '@/lib/push'

interface CreateNotificationParams {
  supabase: SupabaseClient
  orgId: string
  userId: string
  type: string
  title: string
  message: string
  link?: string
  entityType?: string
  entityId?: string
}

/**
 * Fire-and-forget notification creator.
 * Never blocks the response — errors are logged server-side only.
 * Also sends Web Push if user has subscriptions and hasn't disabled the type.
 */
export function createNotification({
  supabase,
  orgId,
  userId,
  type,
  title,
  message,
  link,
  entityType,
  entityId,
}: CreateNotificationParams): void {
  supabase
    .from('notifications')
    .insert({
      org_id: orgId,
      user_id: userId,
      type,
      title,
      message,
      link: link ?? null,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('[notifications]', error.message)
    })

  // Fire-and-forget push notification
  sendPushForUser(supabase, userId, type, title, message, link)
}

/**
 * Fire-and-forget batch notification creator.
 * Inserts multiple notifications in a single query.
 * Also sends Web Push to each recipient.
 */
export function createNotifications(notifications: CreateNotificationParams[]): void {
  if (notifications.length === 0) return

  // All notifications share the same supabase client
  const supabase = notifications[0].supabase

  const rows = notifications.map((n) => ({
    org_id: n.orgId,
    user_id: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link ?? null,
    entity_type: n.entityType ?? null,
    entity_id: n.entityId ?? null,
  }))

  supabase
    .from('notifications')
    .insert(rows)
    .then(({ error }) => {
      if (error) console.error('[notifications]', error.message)
    })

  // Fire-and-forget push for each recipient
  for (const n of notifications) {
    sendPushForUser(n.supabase, n.userId, n.type, n.title, n.message, n.link)
  }
}

async function sendPushForUser(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  try {
    const { data: prefs } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', userId)
      .single()

    if (!userWantsPush(prefs?.notification_preferences, type)) return

    await sendPushToUser(supabase, userId, {
      title,
      body: message,
      url: link,
      icon: '/innov8iv-logo.png',
    })
  } catch (err) {
    console.error('[push-notification]', err)
  }
}
