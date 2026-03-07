import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@innov8iv.co.uk'

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webPush = require('web-push') as typeof import('web-push')
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()
    if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', appUser.id)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ error: 'No push subscriptions found for your account' }, { status: 400 })
    }

    const payload = JSON.stringify({
      title: 'Innov8iv Engage',
      body: 'Push notifications are working!',
      url: '/profile',
      icon: '/innov8iv-logo.png',
    })

    const results: { status?: number; ok?: boolean; message?: string }[] = []

    for (const sub of subs) {
      try {
        const result = await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        results.push({ status: result.statusCode, ok: true })
      } catch (err: any) {
        results.push({ status: err?.statusCode, message: err?.message })
      }
    }

    return NextResponse.json({ ok: true, subscriptionCount: subs.length, results })
  } catch (err: any) {
    console.error('[push-test]', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
