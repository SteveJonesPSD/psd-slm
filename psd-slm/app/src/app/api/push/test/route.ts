import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webPush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@innov8iv.co.uk'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()
    if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check they have a subscription
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', appUser.id)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'No push subscriptions found for your account' }, { status: 400 })
    }

    // Debug info
    const debug: any = {
      vapidPublicKeyLength: VAPID_PUBLIC_KEY.length,
      vapidPrivateKeyLength: VAPID_PRIVATE_KEY.length,
      vapidSubject: VAPID_SUBJECT,
      subscriptionCount: subs.length,
      endpoint: subs[0].endpoint.substring(0, 80) + '...',
      results: [],
    }

    const payload = JSON.stringify({
      title: 'Innov8iv Engage',
      body: 'Push notifications are working!',
      url: '/profile',
      icon: '/innov8iv-logo.png',
    })

    for (const sub of subs) {
      try {
        webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
        const result = await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        debug.results.push({ status: result.statusCode, ok: true })
      } catch (err: any) {
        debug.results.push({
          status: err?.statusCode,
          message: err?.message,
          body: err?.body,
        })
      }
    }

    return NextResponse.json({ ok: true, debug })
  } catch (err: any) {
    console.error('[push-test]', err)
    return NextResponse.json({ error: err?.message || 'Internal error', stack: err?.stack }, { status: 500 })
  }
}
