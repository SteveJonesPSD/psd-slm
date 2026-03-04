'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addWatcher, removeWatcher } from '../../actions'
import { useAuth } from '@/components/auth-provider'

interface WatchersSectionProps {
  ticketId: string
  watchers: Record<string, unknown>[]
  teamMembers: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null }[]
}

interface Watcher {
  id: string
  first_name: string
  last_name: string
  initials: string | null
  color: string | null
}

export function WatchersSection({ ticketId, watchers, teamMembers }: WatchersSectionProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [showPicker, setShowPicker] = useState(false)

  const watcherList = watchers as unknown as Watcher[]
  const isWatching = watcherList.some(w => w.id === user.id)
  const unwatchedMembers = teamMembers.filter(m => !watcherList.find(w => w.id === m.id))

  async function handleToggleWatch() {
    if (isWatching) {
      await removeWatcher(ticketId, user.id)
    } else {
      await addWatcher(ticketId, user.id)
    }
    router.refresh()
  }

  async function handleAddWatcher(userId: string) {
    await addWatcher(ticketId, userId)
    setShowPicker(false)
    router.refresh()
  }

  async function handleRemoveWatcher(userId: string) {
    await removeWatcher(ticketId, userId)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Watchers</h4>
        <button
          onClick={handleToggleWatch}
          className={`text-xs ${isWatching ? 'text-slate-500 hover:text-slate-700' : 'text-indigo-600 hover:text-indigo-800'}`}
        >
          {isWatching ? 'Unwatch' : 'Watch'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {watcherList.map(w => (
          <div
            key={w.id}
            className="group relative flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white cursor-default"
            style={{ backgroundColor: w.color || '#6366f1' }}
            title={`${w.first_name} ${w.last_name}`}
          >
            {w.initials || '?'}
            {w.id !== user.id && (
              <button
                onClick={() => handleRemoveWatcher(w.id)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white group-hover:flex"
              >
                x
              </button>
            )}
          </div>
        ))}
        {watcherList.length === 0 && (
          <span className="text-xs text-slate-300">No watchers</span>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          + Add watcher
        </button>
        {showPicker && unwatchedMembers.length > 0 && (
          <div className="absolute left-0 top-full mt-1 z-10 w-48 rounded-lg border border-gray-200 bg-white shadow-lg max-h-40 overflow-y-auto">
            {unwatchedMembers.map(m => (
              <button
                key={m.id}
                onClick={() => handleAddWatcher(m.id)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
              >
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white"
                  style={{ backgroundColor: m.color || '#6366f1' }}
                >
                  {m.initials || '?'}
                </div>
                {m.first_name} {m.last_name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
