'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission, requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { encrypt, decrypt, blindIndex } from '@/lib/crypto'
import crypto from 'crypto'

async function getAcceptedDomains(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string[]> {
  const { data } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', orgId)
    .eq('setting_key', 'accepted_email_domains')
    .single()

  if (!data?.setting_value) return []
  try {
    const parsed = typeof data.setting_value === 'string'
      ? JSON.parse(data.setting_value)
      : data.setting_value
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function validateEmailDomain(email: string, acceptedDomains: string[]): string | null {
  if (acceptedDomains.length === 0) return null
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return 'Invalid email address.'
  if (!acceptedDomains.includes(domain)) {
    return `Email domain "@${domain}" is not allowed. Accepted domains: ${acceptedDomains.map(d => '@' + d).join(', ')}`
  }
  return null
}

// ---------------------------------------------------------------------------
// Welcome email
// ---------------------------------------------------------------------------

async function sendWelcomeEmail(
  orgId: string,
  recipientEmail: string,
  recipientName: string,
  tempPassword: string,
  orgName: string,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient()
    const { data: channel } = await adminClient
      .from('mail_channels')
      .select('mailbox_address, mail_connections(*)')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!channel?.mail_connections) {
      return { sent: false, error: 'No active mail channel configured' }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const { GraphClient } = await import('@/lib/email/graph-client')
    const client = new GraphClient(channel.mail_connections as never)

    await client.sendMail(channel.mailbox_address, {
      to: [{ address: recipientEmail, name: recipientName }],
      subject: `Your ${orgName} account has been created`,
      bodyHtml: buildWelcomeEmailHtml(orgName, recipientName, recipientEmail, tempPassword, siteUrl),
    })

    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[team] Welcome email failed:', msg)
    return { sent: false, error: msg }
  }
}

function buildWelcomeEmailHtml(
  orgName: string,
  name: string,
  email: string,
  password: string,
  siteUrl: string,
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; }
  .container { max-width: 640px; margin: 0 auto; padding: 24px; }
  .credentials { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 14px; }
  .credentials div { margin: 4px 0; }
  .credentials .label { color: #64748b; }
  .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #7c3aed); color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 16px; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<div class="container">
  <p>Hi ${name},</p>
  <p>Your <strong>${orgName}</strong> account has been created. Use the credentials below to sign in:</p>
  <div class="credentials">
    <div><span class="label">Email:</span> ${email}</div>
    <div><span class="label">Password:</span> ${password}</div>
  </div>
  <p>You will be asked to change your password after your first login.</p>
  <a href="${siteUrl}/auth/login" class="btn">Sign In</a>
  <div class="footer">
    <p>${orgName} — Innov8iv Engage</p>
  </div>
</div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Get org name helper
// ---------------------------------------------------------------------------

async function getOrgName(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string> {
  const { data } = await supabase
    .from('org_settings')
    .select('setting_value')
    .eq('org_id', orgId)
    .eq('setting_key', 'org_name')
    .single()
  return (data?.setting_value as string) || 'Innov8iv Engage'
}

// ---------------------------------------------------------------------------
// Single invite
// ---------------------------------------------------------------------------

export async function inviteUser(formData: FormData) {
  const user = await requirePermission('team', 'create')
  const adminClient = createAdminClient()
  const supabase = await createClient()

  const email = (formData.get('email') as string).trim().toLowerCase()
  const firstName = (formData.get('first_name') as string).trim()
  const lastName = (formData.get('last_name') as string).trim()
  const roleId = formData.get('role_id') as string
  const color = (formData.get('color') as string) || '#6366f1'
  const sendEmail = formData.get('send_email') !== 'false'

  if (!email || !firstName || !lastName || !roleId) {
    return { error: 'All fields are required.' }
  }

  // Validate email domain against accepted domains
  const acceptedDomains = await getAcceptedDomains(supabase, user.orgId)
  const domainError = validateEmailDomain(email, acceptedDomains)
  if (domainError) return { error: domainError }

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

  // Insert users row (RLS-scoped) — encrypt email
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      org_id: user.orgId,
      auth_id: authData.user.id,
      email: encrypt(email),
      email_blind: blindIndex(email.toLowerCase().trim()),
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

  // Send welcome email (fire-and-forget — don't block invite on email failure)
  let emailSent = false
  let emailError: string | undefined
  if (sendEmail) {
    const orgName = await getOrgName(supabase, user.orgId)
    const result = await sendWelcomeEmail(user.orgId, email, firstName, tempPassword, orgName)
    emailSent = result.sent
    emailError = result.error
  }

  revalidatePath('/team')
  return { data: { tempPassword, emailSent, emailError } }
}

// ---------------------------------------------------------------------------
// Bulk invite
// ---------------------------------------------------------------------------

export interface BulkInviteEntry {
  email: string
  firstName: string
  lastName: string
}

export interface BulkInviteResult {
  email: string
  success: boolean
  tempPassword?: string
  emailSent?: boolean
  error?: string
}

export async function bulkInviteUsers(
  entries: BulkInviteEntry[],
  roleId: string,
  sendEmails: boolean,
): Promise<{ results: BulkInviteResult[] }> {
  const user = await requirePermission('team', 'create')
  const adminClient = createAdminClient()
  const supabase = await createClient()

  if (!roleId) return { results: entries.map(e => ({ email: e.email, success: false, error: 'Role is required.' })) }
  if (entries.length === 0) return { results: [] }
  if (entries.length > 50) return { results: entries.map(e => ({ email: e.email, success: false, error: 'Maximum 50 invites at once.' })) }

  const acceptedDomains = await getAcceptedDomains(supabase, user.orgId)
  const orgName = sendEmails ? await getOrgName(supabase, user.orgId) : ''

  const results: BulkInviteResult[] = []

  for (const entry of entries) {
    const email = entry.email.trim().toLowerCase()
    const firstName = entry.firstName.trim()
    const lastName = entry.lastName.trim()

    if (!email || !firstName || !lastName) {
      results.push({ email, success: false, error: 'Name and email are required.' })
      continue
    }

    // Validate email format
    if (!email.includes('@') || !email.includes('.')) {
      results.push({ email, success: false, error: 'Invalid email address.' })
      continue
    }

    // Validate domain
    const domainError = validateEmailDomain(email, acceptedDomains)
    if (domainError) {
      results.push({ email, success: false, error: domainError })
      continue
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
      results.push({ email, success: false, error: authError.message })
      continue
    }

    // Pick a random colour from the preset palette
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#1e293b']
    const color = colors[results.length % colors.length]

    // Insert users row — encrypt email
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        org_id: user.orgId,
        auth_id: authData.user.id,
        email: encrypt(email),
        email_blind: blindIndex(email.toLowerCase().trim()),
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
      await adminClient.auth.admin.deleteUser(authData.user.id)
      results.push({ email, success: false, error: insertError.message })
      continue
    }

    logActivity({ supabase, user, entityType: 'user', entityId: newUser.id, action: 'invited', details: { email, name: `${firstName} ${lastName}`, bulk: true } })

    // Send welcome email
    let emailSent = false
    if (sendEmails) {
      const emailResult = await sendWelcomeEmail(user.orgId, email, firstName, tempPassword, orgName)
      emailSent = emailResult.sent
    }

    results.push({ email, success: true, tempPassword, emailSent })
  }

  revalidatePath('/team')
  return { results }
}

// ---------------------------------------------------------------------------
// Existing actions (unchanged)
// ---------------------------------------------------------------------------

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
  const avatarUrl = formData.get('avatar_url') as string | null

  if (!email || !firstName || !lastName || !roleId) {
    return { error: 'All fields are required.' }
  }

  // Fetch existing user to check email change — use blind index comparison
  const { data: existing } = await supabase
    .from('users')
    .select('email, email_blind, auth_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { error: 'User not found.' }
  }

  // Compare via blind index (encrypted email can't be compared directly)
  const newBlind = blindIndex(email.toLowerCase().trim())
  const emailChanged = existing.email_blind !== newBlind

  // Validate email domain if email is changing
  if (emailChanged) {
    const acceptedDomains = await getAcceptedDomains(supabase, user.orgId)
    const domainError = validateEmailDomain(email, acceptedDomains)
    if (domainError) return { error: domainError }
  }

  // Update users row — encrypt email
  const { error: updateError } = await supabase
    .from('users')
    .update({
      email: encrypt(email),
      email_blind: newBlind,
      first_name: firstName,
      last_name: lastName,
      role_id: roleId,
      initials,
      color,
      avatar_url: avatarUrl || null,
    })
    .eq('id', id)

  if (updateError) {
    return { error: updateError.message }
  }

  // If email changed, update auth account too
  if (existing.auth_id && emailChanged) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      existing.auth_id,
      { email }
    )
    if (authError) {
      // Revert email in users table (re-encrypt old value)
      await supabase.from('users').update({ email: existing.email, email_blind: existing.email_blind }).eq('id', id)
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

export async function resetPassword(id: string, newPassword: string) {
  const user = await requirePermission('team', 'edit_all')
  const adminClient = createAdminClient()
  const supabase = await createClient()

  if (id === user.id) {
    return { error: 'Use the change password page to change your own password.' }
  }

  if (!newPassword || newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  // Fetch target user
  const { data: target } = await supabase
    .from('users')
    .select('auth_id, first_name, last_name, email')
    .eq('id', id)
    .single()

  if (!target || !target.auth_id) {
    return { error: 'User not found.' }
  }

  // Update auth password
  const { error: authError } = await adminClient.auth.admin.updateUserById(
    target.auth_id,
    { password: newPassword }
  )

  if (authError) {
    return { error: authError.message }
  }

  // Set must_change_password flag
  const { error: flagError } = await supabase
    .from('users')
    .update({ must_change_password: true })
    .eq('id', id)

  if (flagError) {
    return { error: `Password changed but flag update failed: ${flagError.message}` }
  }

  logActivity({ supabase, user, entityType: 'user', entityId: id, action: 'password_reset', details: { email: target.email, name: `${target.first_name} ${target.last_name}` } })

  revalidatePath('/team')
  return { success: true }
}

export async function clearUserPasskeysAction(userId: string) {
  const user = await requirePermission('team', 'edit_all')
  const supabase = await createClient()

  if (userId === user.id) {
    return { error: 'Use the security settings page to manage your own passkeys.' }
  }

  // Get target user's auth_id
  const { data: target } = await supabase
    .from('users')
    .select('auth_id, first_name, last_name, email')
    .eq('id', userId)
    .single()

  if (!target || !target.auth_id) {
    return { error: 'User not found.' }
  }

  const { clearUserPasskeys } = await import('@/lib/passkeys')
  const count = await clearUserPasskeys(target.auth_id)

  logActivity({
    supabase,
    user,
    entityType: 'user',
    entityId: userId,
    action: 'passkeys_cleared',
    details: { cleared_count: count, email: target.email, name: `${target.first_name} ${target.last_name}` },
  })

  revalidatePath('/team')
  return { success: true, count }
}

export async function getPasskeyCountForUser(userId: string): Promise<number> {
  await requireAuth()
  const supabase = await createClient()

  // Get auth_id for this user
  const { data: target } = await supabase
    .from('users')
    .select('auth_id')
    .eq('id', userId)
    .single()

  if (!target?.auth_id) return 0

  const { getPasskeyCount } = await import('@/lib/passkeys')
  return getPasskeyCount(target.auth_id)
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
