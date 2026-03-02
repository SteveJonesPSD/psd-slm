'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function getUnreadCount() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return count ?? 0
}

export async function getNotifications(page = 1) {
  const user = await requireAuth()
  const supabase = await createClient()

  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  return {
    notifications: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

export async function markAsRead(id: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/notifications')
  return { success: true }
}

export async function markAllAsRead() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return { error: error.message }

  revalidatePath('/notifications')
  return { success: true }
}
