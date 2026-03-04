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
