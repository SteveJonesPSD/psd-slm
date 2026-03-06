import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000    // 2 minutes — colored avatar
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000    // 5 minutes — visible at all
const GC_THRESHOLD_MS = 5 * 60 * 1000        // 5 minutes — delete stale rows

function isMobileUA(ua: string): boolean {
  return /mobile|iphone|ipad|ipod|android|blackberry|opera mini|iemobile/i.test(ua)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get org_id from users table
    const { data: appUser } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('auth_id', user.id)
      .single()

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { isActive } = await request.json()
    const now = new Date().toISOString()
    const ua = request.headers.get('user-agent') || ''
    const isMobile = isMobileUA(ua)

    // Upsert own heartbeat
    if (isActive) {
      await supabase
        .from('system_presence')
        .upsert(
          { user_id: appUser.id, org_id: appUser.org_id, last_heartbeat: now, last_active: now, is_mobile: isMobile },
          { onConflict: 'user_id' }
        )
    } else {
      const { data: updated } = await supabase
        .from('system_presence')
        .update({ last_heartbeat: now, is_mobile: isMobile })
        .eq('user_id', appUser.id)
        .select('user_id')

      if (!updated || updated.length === 0) {
        await supabase
          .from('system_presence')
          .upsert(
            { user_id: appUser.id, org_id: appUser.org_id, last_heartbeat: now, last_active: now, is_mobile: isMobile },
            { onConflict: 'user_id' }
          )
      }
    }

    // Garbage-collect stale rows
    const gcThreshold = new Date(Date.now() - GC_THRESHOLD_MS).toISOString()
    await supabase
      .from('system_presence')
      .delete()
      .lt('last_heartbeat', gcThreshold)

    // Fetch other org users within the online window
    const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString()
    const activeThreshold = new Date(Date.now() - ACTIVE_THRESHOLD_MS).toISOString()

    const { data } = await supabase
      .from('system_presence')
      .select('user_id, last_active, is_mobile, users:user_id(id, first_name, last_name, initials, color, avatar_url)')
      .gt('last_heartbeat', onlineThreshold)
      .neq('user_id', appUser.id)

    const onlineUsers = (data || []).map((row: Record<string, unknown>) => {
      const u = row.users as Record<string, unknown>
      const lastActive = row.last_active as string
      return {
        id: u.id as string,
        firstName: u.first_name as string,
        lastName: u.last_name as string,
        initials: (u.initials as string) || null,
        color: (u.color as string) || null,
        avatarUrl: (u.avatar_url as string) || null,
        status: lastActive >= activeThreshold ? 'active' : 'idle',
        isMobile: (row.is_mobile as boolean) || false,
      }
    })

    onlineUsers.sort((a, b) => {
      if (a.status === b.status) return 0
      return a.status === 'active' ? -1 : 1
    })

    return NextResponse.json({ onlineUsers })
  } catch {
    return NextResponse.json({ onlineUsers: [] })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: true })

    const { data: appUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (appUser) {
      await supabase
        .from('system_presence')
        .delete()
        .eq('user_id', appUser.id)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
