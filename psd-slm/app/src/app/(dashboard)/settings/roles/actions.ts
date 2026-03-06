'use server'

import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import type { Role, Permission, RolePermission } from '@/types/database'

// --- Read ---

export async function getRoles(): Promise<(Role & { user_count: number })[]> {
  const user = await requirePermission('settings', 'view')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('*, users(count)')
    .eq('org_id', user.orgId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as Role),
    user_count: Array.isArray(r.users) ? (r.users[0] as { count: number })?.count ?? 0 : 0,
  }))
}

export async function getPermissions(): Promise<Permission[]> {
  const user = await requirePermission('settings', 'view')
  const supabase = await createClient()
  // Need admin client for permissions table (no org_id filter needed)
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('module')
    .order('action')
  if (error) throw error
  return data ?? []
}

export async function getRolePermissionIds(roleId: string): Promise<string[]> {
  await requirePermission('settings', 'view')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId)
  if (error) throw error
  return (data ?? []).map((rp) => rp.permission_id)
}

// --- Mutations ---

export async function createRole(name: string, displayName: string, description?: string) {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = await createClient()

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from('roles')
    .select('sort_order')
    .eq('org_id', user.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('roles')
    .insert({
      org_id: user.orgId,
      name: name.toLowerCase().replace(/\s+/g, '_'),
      display_name: displayName,
      description: description ?? null,
      is_system: false,
      sort_order: nextOrder,
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return { error: 'A role with this name already exists.' }
    return { error: error.message }
  }

  logActivity({ supabase, user, entityType: 'role', entityId: data.id, action: 'created', details: { name: displayName } })
  revalidatePath('/settings/roles')
  return { data }
}

export async function updateRole(id: string, updates: { display_name?: string; description?: string }) {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = await createClient()

  // Guard: cannot edit system roles' names
  const { data: role } = await supabase.from('roles').select('is_system, display_name').eq('id', id).single()
  if (!role) return { error: 'Role not found.' }

  const { error } = await supabase
    .from('roles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'role', entityId: id, action: 'updated', details: updates })
  revalidatePath('/settings/roles')
  return { success: true }
}

export async function deleteRole(id: string) {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = await createClient()

  const { data: role } = await supabase.from('roles').select('is_system, display_name').eq('id', id).single()
  if (!role) return { error: 'Role not found.' }
  if (role.is_system) return { error: 'Cannot delete a system role.' }

  // Check if any users assigned
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', id)
  if ((count ?? 0) > 0) return { error: `Cannot delete this role — ${count} user(s) are still assigned to it.` }

  const { error } = await supabase.from('roles').delete().eq('id', id)
  if (error) return { error: error.message }

  logActivity({ supabase, user, entityType: 'role', entityId: id, action: 'deleted', details: { name: role.display_name } })
  revalidatePath('/settings/roles')
  return { success: true }
}

export async function saveRolePermissions(roleId: string, permissionIds: string[]) {
  const user = await requirePermission('settings', 'edit_all')
  const supabase = await createClient()

  // Guard: cannot edit system role permissions
  const { data: role } = await supabase.from('roles').select('is_system, display_name').eq('id', roleId).single()
  if (!role) return { error: 'Role not found.' }
  if (role.is_system) return { error: 'System role permissions cannot be modified.' }

  // Delete existing
  const { error: delError } = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId)
  if (delError) return { error: delError.message }

  // Insert new set
  if (permissionIds.length > 0) {
    const { error: insError } = await supabase
      .from('role_permissions')
      .insert(permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid })))
    if (insError) return { error: insError.message }
  }

  logActivity({
    supabase,
    user,
    entityType: 'role',
    entityId: roleId,
    action: 'permissions_updated',
    details: { role_name: role.display_name, permission_count: permissionIds.length },
  })
  revalidatePath('/settings/roles')
  return { success: true }
}
