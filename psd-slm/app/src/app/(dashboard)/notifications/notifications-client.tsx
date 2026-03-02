'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { markAsRead, markAllAsRead, getNotifications } from './actions'
import { formatRelativeTime } from '@/lib/utils'
import type { Notification } from '@/types/database'

const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  quote_accepted: '✅',
  quote_declined: '❌',
  change_request: '✏️',
}

interface NotificationsClientProps {
  initialNotifications: Notification[]
  initialTotal: number
}

export function NotificationsClient({ initialNotifications, initialTotal }: NotificationsClientProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  const handleMarkAllRead = async () => {
    await markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    router.refresh()
  }

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await markAsRead(n.id)
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      )
    }
    if (n.link) router.push(n.link)
  }

  const handlePageChange = async (newPage: number) => {
    setLoading(true)
    const result = await getNotifications(newPage)
    setNotifications(result.notifications)
    setTotal(result.total)
    setPage(newPage)
    setLoading(false)
  }

  const hasUnread = notifications.some((n) => !n.is_read)

  return (
    <>
      {hasUnread && (
        <div className="mb-4">
          <Button size="sm" variant="default" onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        {notifications.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No notifications yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex items-start gap-3 w-full px-5 py-4 text-left transition-colors hover:bg-slate-50 ${
                  !n.is_read ? 'bg-indigo-50/30' : ''
                }`}
              >
                {/* Unread dot */}
                <div className="pt-1.5 w-3 shrink-0">
                  {!n.is_read && (
                    <span className="block h-2 w-2 rounded-full bg-indigo-500" />
                  )}
                </div>

                {/* Icon */}
                <span className="text-lg pt-0.5 w-6 shrink-0">
                  {NOTIFICATION_TYPE_ICONS[n.type] || '🔔'}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm font-medium ${n.is_read ? 'text-slate-600' : 'text-slate-900'}`}>
                      {n.title}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {formatRelativeTime(n.created_at)}
                    </span>
                  </div>
                  <p className={`text-sm mt-0.5 ${n.is_read ? 'text-slate-400' : 'text-slate-600'}`}>
                    {n.message}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            size="sm"
            variant="default"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || loading}
          >
            Newer
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="default"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Older
          </Button>
        </div>
      )}
    </>
  )
}
