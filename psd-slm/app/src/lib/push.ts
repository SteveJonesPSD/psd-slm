import { SupabaseClient } from '@supabase/supabase-js'

let _webPushReady = false

function getWebPush() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const webPush = require('web-push') as typeof import('web-push')
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  const priv = process.env.VAPID_PRIVATE_KEY || ''
  if (!pub || !priv) return null
  if (!_webPushReady) {
    const subject = process.env.VAPID_SUBJECT || 'mailto:support@innov8iv.co.uk'
    webPush.setVapidDetails(subject, pub, priv)
    _webPushReady = true
  }
  return webPush
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
  const webPush = getWebPush()
  if (!webPush) return

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
