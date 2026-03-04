'use server'

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export interface OnlineUser {
  id: string
  firstName: string
  lastName: string
  initials: string | null
  color: string | null
  avatarUrl: string | null
  status: 'active' | 'idle'
}

const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000    // 2 minutes — colored avatar
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000    // 5 minutes — visible at all
const GC_THRESHOLD_MS = 5 * 60 * 1000        // 5 minutes — delete stale rows

export async function heartbeatSystemPresence(
  isActive: boolean
): Promise<{ onlineUsers: OnlineUser[] }> {
  const user = await requireAuth()
  const supabase = await createClient()

  const now = new Date().toISOString()

  // Upsert own heartbeat — always update last_heartbeat, only update last_active when user is interacting
  if (isActive) {
    await supabase
      .from('system_presence')
      .upsert(
        { user_id: user.id, org_id: user.orgId, last_heartbeat: now, last_active: now },
        { onConflict: 'user_id' }
      )
  } else {
    // Try update first (preserves last_active), then insert if no row exists
    const { data: updated } = await supabase
      .from('system_presence')
      .update({ last_heartbeat: now })
      .eq('user_id', user.id)
      .select('user_id')

    if (!updated || updated.length === 0) {
      // No existing row — insert with both timestamps
      await supabase
        .from('system_presence')
        .upsert(
          { user_id: user.id, org_id: user.orgId, last_heartbeat: now, last_active: now },
          { onConflict: 'user_id' }
        )
    }
  }

  // Garbage-collect stale rows (>5 min old)
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
    .select('user_id, last_active, users:user_id(id, first_name, last_name, initials, color, avatar_url)')
    .gt('last_heartbeat', onlineThreshold)
    .neq('user_id', user.id)

  const onlineUsers: OnlineUser[] = (data || []).map((row: Record<string, unknown>) => {
    const u = row.users as Record<string, unknown>
    const lastActive = row.last_active as string
    return {
      id: u.id as string,
      firstName: u.first_name as string,
      lastName: u.last_name as string,
      initials: (u.initials as string) || null,
      color: (u.color as string) || null,
      avatarUrl: (u.avatar_url as string) || null,
      status: lastActive >= activeThreshold ? 'active' as const : 'idle' as const,
    }
  })

  // Sort: active users first, then idle
  onlineUsers.sort((a, b) => {
    if (a.status === b.status) return 0
    return a.status === 'active' ? -1 : 1
  })

  return { onlineUsers }
}

export async function clearSystemPresence(): Promise<void> {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    await supabase
      .from('system_presence')
      .delete()
      .eq('user_id', user.id)
  } catch {
    // Best-effort — staleness threshold handles cleanup
  }
}
