import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatRelativeTime } from '@/lib/utils'
import { NotificationsClient } from './notifications-client'
import type { Notification } from '@/types/database'

export default async function NotificationsPage() {
  await requireAuth()
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 19)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Notifications</h2>
      </div>

      <NotificationsClient
        initialNotifications={(data ?? []) as Notification[]}
        initialTotal={count ?? 0}
      />
    </div>
  )
}
