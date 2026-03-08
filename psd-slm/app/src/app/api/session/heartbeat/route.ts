import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity-log'
import crypto from 'crypto'

const IDLE_THRESHOLD_MINUTES = 15

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const { isActive, idleMinutes } = await request.json()

    // Hash the JWT sub + created_at to create a stable session token
    const sessionToken = crypto
      .createHmac('sha256', process.env.BLIND_INDEX_PEPPER ?? 'fallback')
      .update(`${user.id}:${user.created_at}`)
      .digest('hex')
      .slice(0, 32)

    const adminSupabase = createAdminClient()

    // Resolve org_id from users table
    const { data: profile } = await adminSupabase
      .from('users')
      .select('id, org_id, first_name, last_name')
      .eq('auth_id', user.id)
      .single()

    if (!profile) return NextResponse.json({ ok: false }, { status: 401 })

    const { data: existingSession } = await adminSupabase
      .from('user_sessions')
      .select('id, idle_since, last_active_at')
      .eq('session_token', sessionToken)
      .is('ended_at', null)
      .single()

    const now = new Date().toISOString()

    if (!existingSession) {
      await adminSupabase.from('user_sessions').insert({
        org_id: profile.org_id,
        user_id: profile.id,
        session_token: sessionToken,
        last_active_at: now,
      })
    } else {
      const wasIdle = existingSession.idle_since !== null
      const returnedFromIdle = wasIdle && isActive

      if (returnedFromIdle) {
        const idleStart = new Date(existingSession.idle_since!).getTime()
        const idleDuration = Math.round((Date.now() - idleStart) / 60000)

        if (idleDuration >= IDLE_THRESHOLD_MINUTES) {
          // Log idle period for engagement reporting
          logActivity({
            supabase: adminSupabase,
            user: {
              id: profile.id,
              orgId: profile.org_id,
            } as Parameters<typeof logActivity>[0]['user'],
            entityType: 'session',
            entityId: existingSession.id,
            action: 'idle_period',
            details: {
              idle_minutes: idleDuration,
              idle_since: existingSession.idle_since,
              returned_at: now,
            },
          })
        }
      }

      await adminSupabase
        .from('user_sessions')
        .update({
          last_active_at: isActive ? now : existingSession.last_active_at,
          idle_since: isActive ? null : (existingSession.idle_since ?? now),
        })
        .eq('id', existingSession.id)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
