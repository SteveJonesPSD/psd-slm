import webPush from 'web-push'
import { SupabaseClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@innov8iv.co.uk'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

/**
 * Send push notification to all subscriptions for a user.
 * Fire-and-forget — never blocks the caller.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return

  const jsonPayload = JSON.stringify(payload)

  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        jsonPayload
      )
    } catch (err: any) {
      // 410 Gone or 404 = subscription expired, clean up
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('[push]', err?.message || err)
      }
    }
  }
}

/**
 * Check if a user wants push for a given notification type.
 * Default: all push-enabled types send notifications unless explicitly disabled.
 */
export function userWantsPush(
  preferences: Record<string, any> | null | undefined,
  notificationType: string
): boolean {
  if (!preferences) return true
  const pushPrefs = preferences.push as Record<string, boolean> | undefined
  if (!pushPrefs) return true
  // Explicit false = disabled
  return pushPrefs[notificationType] !== false
}
