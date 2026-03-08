'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { logAuthEvent } from '@/lib/auth-log'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    logAuthEvent({
      eventType: 'login_failure',
      authMethod: 'password',
      success: false,
      failureReason: 'invalid_password',
    })
    return { error: error.message }
  }

  // Fire-and-forget login success event
  if (data.user) {
    const orgId = data.user.user_metadata?.org_id ?? null
    logAuthEvent({
      orgId,
      userId: data.user.id,
      eventType: 'login_success',
      authMethod: 'password',
    })
  }

  const redirectTo = (formData.get('redirect') as string) || '/'
  redirect(redirectTo)
}

export async function signOut() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  logAuthEvent({
    orgId: user?.user_metadata?.org_id ?? null,
    userId: user?.id ?? null,
    eventType: 'logout',
  })

  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function changePassword(formData: FormData) {
  const user = await requireAuth()
  const supabase = await createClient()

  const currentPassword = formData.get('current_password') as string
  const newPassword = formData.get('new_password') as string

  if (!currentPassword || !newPassword) {
    return { error: 'All fields are required.' }
  }

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters.' }
  }

  // Re-authenticate with current password to verify identity
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (signInError) {
    return { error: 'Current password is incorrect.' }
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return { error: updateError.message }
  }

  // Clear the forced change flag
  await supabase.rpc('clear_must_change_password')

  logActivity({ supabase, user, entityType: 'user', entityId: user.id, action: 'password_changed' })
  logAuthEvent({ orgId: user.orgId, userId: user.id, eventType: 'password_changed', authMethod: 'password' })

  return { success: true }
}
