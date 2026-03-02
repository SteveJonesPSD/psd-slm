import { SupabaseClient } from '@supabase/supabase-js'

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
}

/**
 * Fire-and-forget batch notification creator.
 * Inserts multiple notifications in a single query.
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
}
