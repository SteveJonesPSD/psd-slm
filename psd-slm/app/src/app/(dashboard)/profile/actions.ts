'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function getMyAiPreferences(): Promise<Record<string, string>> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('users')
    .select('ai_preferences')
    .eq('id', user.id)
    .single()

  return (data?.ai_preferences as Record<string, string>) || {}
}

export async function saveThemePreference(
  theme: string
): Promise<{ success?: boolean; error?: string }> {
  if (!['light', 'dark', 'system'].includes(theme)) {
    return { error: 'Invalid theme value' }
  }
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('users')
    .update({ theme_preference: theme, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

export async function getMyViewPreferences(): Promise<Record<string, string>> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('users')
    .select('view_preferences')
    .eq('id', user.id)
    .single()

  return (data?.view_preferences as Record<string, string>) || {}
}

export async function saveMyViewPreferences(
  prefs: Record<string, string>
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('users')
    .update({ view_preferences: prefs, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

export async function getMyNotificationPreferences(): Promise<Record<string, any>> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('users')
    .select('notification_preferences')
    .eq('id', user.id)
    .single()

  return (data?.notification_preferences as Record<string, any>) || {}
}

export async function saveMyNotificationPreferences(
  prefs: Record<string, any>
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('users')
    .update({ notification_preferences: prefs, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

export async function saveMyAiPreferences(
  prefs: Record<string, string>
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('users')
    .update({ ai_preferences: prefs, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}
