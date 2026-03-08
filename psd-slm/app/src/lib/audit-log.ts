'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth'

export interface ActivityLogFilters {
  userId?: string
  entityType?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export async function getActivityLog(filters: ActivityLogFilters = {}) {
  const user = await requirePermission('settings', 'view')
  const supabase = await createClient()
  const { page = 1, pageSize = 50 } = filters
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('activity_log')
    .select(`
      id, entity_type, entity_id, action, details, created_at,
      user:users!user_id(id, first_name, last_name, avatar_url)
    `, { count: 'exact' })
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.action) query = query.ilike('action', `%${filters.action}%`)
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

  const { data, count, error } = await query

  if (error) return { error: error.message }
  return { data: data || [], total: count || 0 }
}

export interface AuthEventFilters {
  userId?: string
  eventType?: string
  failuresOnly?: boolean
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export async function getAuthEvents(filters: AuthEventFilters = {}) {
  const user = await requirePermission('settings', 'view')
  const adminSupabase = createAdminClient()
  const { page = 1, pageSize = 50 } = filters
  const offset = (page - 1) * pageSize

  let query = adminSupabase
    .from('auth_events')
    .select(`*`, { count: 'exact' })
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.eventType) query = query.eq('event_type', filters.eventType)
  if (filters.failuresOnly) query = query.eq('success', false)
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

  const { data, count, error } = await query

  if (error) return { error: error.message }

  // Resolve user names from users table
  const userIds = [...new Set((data || []).map(e => e.user_id).filter(Boolean))]
  let userMap: Record<string, { first_name: string; last_name: string }> = {}
  if (userIds.length > 0) {
    const { data: users } = await adminSupabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', userIds)
    if (users) {
      userMap = Object.fromEntries(users.map(u => [u.id, u]))
    }
  }

  const enriched = (data || []).map(e => ({
    ...e,
    user_name: e.user_id && userMap[e.user_id]
      ? `${userMap[e.user_id].first_name} ${userMap[e.user_id].last_name}`
      : null,
  }))

  return { data: enriched, total: count || 0 }
}

export async function getEngagementSummary(dateFrom: string, dateTo: string) {
  const user = await requirePermission('settings', 'view')
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  // Fetch all active users in org
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name, avatar_url, is_active, role:roles!role_id(name)')
    .eq('org_id', user.orgId)
    .eq('is_active', true)

  if (!users) return []

  // Fetch activity counts per user in date range
  const { data: activities } = await adminSupabase
    .from('activity_log')
    .select('user_id, action, entity_type, details')
    .eq('org_id', user.orgId)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)

  // Fetch login counts per user
  const { data: logins } = await adminSupabase
    .from('auth_events')
    .select('user_id, created_at')
    .eq('org_id', user.orgId)
    .eq('event_type', 'login_success')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo)

  // Fetch last active per user from sessions
  const { data: sessions } = await adminSupabase
    .from('user_sessions')
    .select('user_id, last_active_at')
    .eq('org_id', user.orgId)
    .order('last_active_at', { ascending: false })

  // Fetch presence for online status
  const { data: presence } = await adminSupabase
    .from('system_presence')
    .select('user_id, last_seen_at')
    .eq('org_id', user.orgId)

  const presenceMap = new Map((presence || []).map(p => [p.user_id, p.last_seen_at]))

  return users.map(u => {
    const userActivity = (activities || []).filter(a => a.user_id === u.id)
    const ticketActions = userActivity.filter(a =>
      a.entity_type === 'ticket' &&
      ['message_added', 'status_changed', 'first_response'].includes(a.action)
    )
    const idlePeriods = userActivity.filter(a => a.action === 'idle_period')
    const totalIdleMinutes = idlePeriods.reduce((sum, a) => {
      const details = a.details as Record<string, unknown> | null
      return sum + (Number(details?.idle_minutes) || 0)
    }, 0)

    const lastSession = (sessions || []).find(s => s.user_id === u.id)
    const lastPresence = presenceMap.get(u.id)

    return {
      userId: u.id,
      name: `${u.first_name} ${u.last_name}`,
      avatarUrl: u.avatar_url,
      role: (u.role as unknown as { name: string } | null)?.name ?? null,
      lastActiveAt: lastSession?.last_active_at ?? null,
      lastPresenceAt: lastPresence ?? null,
      loginCount: (logins || []).filter(l => l.user_id === u.id).length,
      actionCount: userActivity.length,
      ticketsHandled: ticketActions.length,
      idlePeriodCount: idlePeriods.length,
      totalIdleMinutes,
    }
  })
}

export async function getOrgUsers() {
  const user = await requirePermission('settings', 'view')
  const supabase = await createClient()

  const { data } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('first_name')

  return data || []
}

export async function getRecentFailures() {
  const user = await requirePermission('settings', 'view')
  const adminSupabase = createAdminClient()

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data } = await adminSupabase
    .from('auth_events')
    .select('user_id, created_at')
    .eq('org_id', user.orgId)
    .eq('success', false)
    .gte('created_at', oneHourAgo)

  if (!data || data.length === 0) return null

  // Group by user_id and find any with 5+ failures
  const counts = new Map<string, number>()
  for (const event of data) {
    if (event.user_id) {
      counts.set(event.user_id, (counts.get(event.user_id) || 0) + 1)
    }
  }

  for (const [userId, count] of counts) {
    if (count >= 5) {
      // Resolve user name
      const { data: u } = await adminSupabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', userId)
        .single()
      return {
        userId,
        userName: u ? `${u.first_name} ${u.last_name}` : 'Unknown',
        failureCount: count,
      }
    }
  }

  return null
}
