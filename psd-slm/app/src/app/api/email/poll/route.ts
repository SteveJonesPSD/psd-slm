// =============================================================================
// POST /api/email/poll
// Triggers a mail poll cycle for all active channels.
// Protected by shared secret (org_settings: email_poll_secret).
// Called by cron/scheduler or manual "Poll Now" button (via triggerPoll action).
// Excluded from session auth in proxy.ts — uses its own secret-based auth.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pollMailChannels } from '@/lib/email/mail-poller'

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json()
    const { orgId } = body

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check for configured poll secret
    const { data: secretSetting } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('org_id', orgId)
      .eq('setting_key', 'email_poll_secret')
      .maybeSingle()

    const pollSecret = secretSetting?.setting_value as string | null

    if (pollSecret) {
      // Secret is configured — require it in the Authorization header
      const authHeader = req.headers.get('authorization')
      const providedSecret = authHeader?.replace('Bearer ', '')
      if (providedSecret !== pollSecret) {
        return NextResponse.json({ error: 'Invalid poll secret' }, { status: 401 })
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, require a poll secret to be configured
      return NextResponse.json({ error: 'Poll secret not configured' }, { status: 401 })
    }
    // In development with no secret configured, allow through for easy testing

    const results = await pollMailChannels(supabase, orgId)

    return NextResponse.json({
      results,
      duration_ms: Date.now() - startTime,
    })
  } catch (err) {
    console.error('[email/poll]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Poll failed' },
      { status: 500 }
    )
  }
}
