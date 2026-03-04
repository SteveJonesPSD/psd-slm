'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

function requireAdmin(user: { role: { name: string } }) {
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    throw new Error('Admin access required')
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export interface TeamWithMembers {
  id: string
  name: string
  slug: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  members: {
    user_id: string
    first_name: string
    last_name: string
    initials: string | null
    color: string | null
    email: string
    is_active: boolean
  }[]
}

export async function getTeamsWithMembers(): Promise<{ data?: TeamWithMembers[]; error?: string }> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('org_id', user.orgId)
    .order('name')

  if (teamsError) return { error: teamsError.message }

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('team_id, user_id, users(id, first_name, last_name, initials, color, email, is_active)')
    .in('team_id', (teams || []).map(t => t.id))

  if (membersError) return { error: membersError.message }

  const teamsWithMembers: TeamWithMembers[] = (teams || []).map(team => ({
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description,
    color: team.color || '#6366f1',
    is_active: team.is_active,
    created_at: team.created_at,
    members: (members || [])
      .filter(m => m.team_id === team.id)
      .map(m => {
        const u = m.users as unknown as {
          id: string
          first_name: string
          last_name: string
          initials: string | null
          color: string | null
          email: string
          is_active: boolean
        }
        return {
          user_id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          initials: u.initials,
          color: u.color,
          email: u.email,
          is_active: u.is_active,
        }
      }),
  }))

  return { data: teamsWithMembers }
}

export async function getOrgUsers() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, initials, color, email, is_active')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('first_name')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function createTeam(input: { name: string; description?: string; color?: string }) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const slug = slugify(input.name)
  if (!slug) return { error: 'Invalid team name' }

  const { data, error } = await supabase
    .from('teams')
    .insert({
      org_id: user.orgId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      color: input.color || '#6366f1',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'A team with this name already exists' }
    return { error: error.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'team',
    entityId: data.id,
    action: 'created',
    details: { name: input.name },
  })

  revalidatePath('/settings/teams')
  return { data }
}

export async function updateTeam(
  teamId: string,
  input: { name?: string; description?: string; color?: string; is_active?: boolean }
) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.name !== undefined) {
    updates.name = input.name.trim()
    updates.slug = slugify(input.name)
  }
  if (input.description !== undefined) updates.description = input.description.trim() || null
  if (input.color !== undefined) updates.color = input.color
  if (input.is_active !== undefined) updates.is_active = input.is_active

  const { error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .eq('org_id', user.orgId)

  if (error) {
    if (error.code === '23505') return { error: 'A team with this name already exists' }
    return { error: error.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'team',
    entityId: teamId,
    action: 'updated',
    details: { ...input },
  })

  revalidatePath('/settings/teams')
  return { success: true }
}

export async function deleteTeam(teamId: string) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  // Get team name for logging
  const { data: team } = await supabase
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .single()

  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'team',
    entityId: teamId,
    action: 'deleted',
    details: { name: team?.name },
  })

  revalidatePath('/settings/teams')
  return { success: true }
}

export async function addTeamMember(teamId: string, userId: string) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: userId })

  if (error) {
    if (error.code === '23505') return { error: 'User is already in this team' }
    return { error: error.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'team_member',
    entityId: teamId,
    action: 'added',
    details: { user_id: userId },
  })

  revalidatePath('/settings/teams')
  return { success: true }
}

export async function removeTeamMember(teamId: string, userId: string) {
  const user = await requireAuth()
  requireAdmin(user)
  const supabase = await createClient()

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  logActivity({
    supabase,
    user,
    entityType: 'team_member',
    entityId: teamId,
    action: 'removed',
    details: { user_id: userId },
  })

  revalidatePath('/settings/teams')
  return { success: true }
}
