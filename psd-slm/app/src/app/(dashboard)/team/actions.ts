'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import crypto from 'crypto'

export async function inviteUser(formData: FormData) {
  const user = await requirePermission('team', 'create')
  const adminClient = createAdminClient()
  const supabase = await createClient()

  const email = (formData.get('email') as string).trim().toLowerCase()
  const firstName = (formData.get('first_name') as string).trim()
  const lastName = (formData.get('last_name') as string).trim()
  const roleId = formData.get('role_id') as string
  const color = (formData.get('color') as string) || '#6366f1'

  if (!email || !firstName || !lastName || !roleId) {
    return { error: 'All fields are required.' }
  }

  const initials = (firstName[0] + lastName[0]).toUpperCase()
  const tempPassword = crypto.randomUUID().slice(0, 12)

  // Create auth account
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) {
    return { error: authError.message }
  }

  // Insert users row (RLS-scoped)
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      org_id: user.orgId,
      auth_id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role_id: roleId,
      initials,
      color,
      is_active: true,
      must_change_password: true,
    })
    .select('id')
    .single()

  if (insertError) {
    // Rollback: delete orphaned auth account
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return { error: insertError.message }
  }

  logActivity({ supabase, user, entityType: 'user', entityId: newUser.id, action: 'invited', details: { email, name: `${firstName} ${lastName}` } })

  revalidatePath('/team')
  return { data: { tempPassword } }
}

export async function updateUser(id: string, formData: FormData) {
  const user = await requirePermission('team', 'edit_all')
  const adminClient = createAdminClient()
  const supabase = await createClient()

  const email = (formData.get('email') as string).trim().toLowerCase()
  const firstName = (formData.get('first_name') as string).trim()
  const lastName = (formData.get('last_name') as string).trim()
  const roleId = formData.get('role_id') as string
  const color = (formData.get('color') as string) || '#6366f1'
  const initials = (formData.get('initials') as string)?.trim() || (firstName[0] + lastName[0]).toUpperCase()

  if (!email || !firstName || !lastName || !roleId) {
    return { error: 'All fields are required.' }
  }

  // Fetch existing user to check email change
  const { data: existing } = await supabase
    .from('users')
    .select('email, auth_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { error: 'User not found.' }
  }

  // Update users row
  const { error: updateError } = await supabase
    .from('users')
    .update({
      email,
      first_name: firstName,
      last_name: lastName,
      role_id: roleId,
      initials,
      color,
    })
    .eq('id', id)

  if (updateError) {
    return { error: updateError.message }
  }

  // If email changed, update auth account too
  if (existing.auth_id && existing.email !== email) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      existing.auth_id,
      { email }
    )
    if (authError) {
      // Revert email in users table
      await supabase.from('users').update({ email: existing.email }).eq('id', id)
      return { error: `User saved but email sync failed: ${authError.message}` }
    }
  }

  logActivity({ supabase, user, entityType: 'user', entityId: id, action: 'updated', details: { email, name: `${firstName} ${lastName}` } })

  revalidatePath('/team')
  return { success: true }
}

export async function deactivateUser(id: string) {
  const user = await requirePermission('team', 'delete')
  const adminClient = createAdminClient()
  const supabase = await createClient()

  // Prevent self-deactivation
  if (id === user.id) {
    return { error: 'You cannot deactivate your own account.' }
  }

  // Fetch auth_id
  const { data: target } = await supabase
    .from('users')
    .select('auth_id')
    .eq('id', id)
    .single()

  if (!target) {
    return { error: 'User not found.' }
  }

  // Set inactive
  const { error: updateError } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', id)

  if (updateError) {
    return { error: updateError.message }
  }

  // Ban auth account
  if (target.auth_id) {
    await adminClient.auth.admin.updateUserById(target.auth_id, {
      ban_duration: '876600h',
    })
  }

  logActivity({ supabase, user, entityType: 'user', entityId: id, action: 'deactivated' })

  revalidatePath('/team')
  return { success: true }
}

export async function reactivateUser(id: string) {
  const user = await requirePermission('team', 'edit_all')
  const adminClient = createAdminClient()
  const supabase = await createClient()

  // Fetch auth_id
  const { data: target } = await supabase
    .from('users')
    .select('auth_id')
    .eq('id', id)
    .single()

  if (!target) {
    return { error: 'User not found.' }
  }

  // Set active
  const { error: updateError } = await supabase
    .from('users')
    .update({ is_active: true })
    .eq('id', id)

  if (updateError) {
    return { error: updateError.message }
  }

  // Unban auth account
  if (target.auth_id) {
    await adminClient.auth.admin.updateUserById(target.auth_id, {
      ban_duration: 'none',
    })
  }

  logActivity({ supabase, user, entityType: 'user', entityId: id, action: 'reactivated' })

  revalidatePath('/team')
  return { success: true }
}
