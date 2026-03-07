'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { getNotifications, markAsRead, markAllAsRead } from '@/app/(dashboard)/notifications/actions'
import { formatRelativeTime } from '@/lib/utils'
import type { Notification } from '@/types/database'

const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  quote_accepted: '✅',
  quote_declined: '❌',
  change_request: '✏️',
  ticket_status_changed: '🔄',
  ticket_assigned: '👤',
  ticket_reply: '💬',
  ticket_internal_note: '📝',
}

interface NotificationBellProps {
  collapsed?: boolean
}

export function NotificationBell({ collapsed }: NotificationBellProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ left: 0, bottom: 0 })

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
    } catch {
      // Silently fail — user may not be authenticated yet
    }
  }, [])

  const fetchRecent = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getNotifications(1)
      setNotifications(result.notifications.slice(0, 5))
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [fetchCount])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleToggle = () => {
    const willOpen = !open
    if (willOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        left: rect.right + 8,
        bottom: window.innerHeight - rect.bottom,
      })
    }
    setOpen(willOpen)
    if (willOpen) fetchRecent()
  }

  const handleClickNotification = async (n: Notification) => {
    if (!n.is_read) {
      await markAsRead(n.id)
      setUnreadCount((c) => Math.max(0, c - 1))
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      )
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`flex items-center gap-2.5 w-full rounded-lg px-3.5 py-2.5 text-sm transition-colors text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <span className="relative text-base w-5 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
        {!collapsed && <span className="whitespace-nowrap">Notifications</span>}
      </button>

      {/* Dropdown — rendered via portal to escape sidebar transform/overflow */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-80 rounded-xl border border-slate-700 bg-slate-800 shadow-xl z-50"
          style={{ left: dropdownPos.left, bottom: dropdownPos.bottom }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <span className="text-sm font-semibold text-slate-200">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Items */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">No notifications</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
                >
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                  )}
                  {n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{NOTIFICATION_TYPE_ICONS[n.type] || '🔔'}</span>
                      <span className={`text-sm font-medium truncate ${n.is_read ? 'text-slate-400' : 'text-slate-200'}`}>
                        {n.title}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${n.is_read ? 'text-slate-500' : 'text-slate-400'}`}>
                      {n.message}
                    </p>
                    <span className="text-[10px] text-slate-600 mt-0.5">
                      {formatRelativeTime(n.created_at)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700 px-4 py-2">
            <button
              onClick={() => {
                setOpen(false)
                router.push('/notifications')
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 w-full text-center"
            >
              View all notifications
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
