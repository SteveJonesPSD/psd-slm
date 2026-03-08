'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { OnsiteJobCategory, OjiPriority } from '@/lib/onsite-jobs/types'
import { createPortalOjiAction } from '../portal-actions'

interface PortalNewOjiFormProps {
  categories: OnsiteJobCategory[]
}

export function PortalNewOjiForm({ categories }: PortalNewOjiFormProps) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [onBehalfOf, setOnBehalfOf] = useState('')
  const [roomLocation, setRoomLocation] = useState('')
  const [priority, setPriority] = useState<OjiPriority>('medium')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [preferredDatetime, setPreferredDatetime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subjectError, setSubjectError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) {
      setSubjectError(true)
      return
    }

    setLoading(true)
    setError(null)

    const result = await createPortalOjiAction({
      subject: subject.trim(),
      description: description.trim() || undefined,
      room_location: roomLocation.trim() || undefined,
      priority,
      category_id: categoryId || undefined,
      on_behalf_of_name: onBehalfOf.trim() || undefined,
      preferred_datetime: preferredDatetime || undefined,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/portal/onsite-jobs')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <Link
        href="/portal/onsite-jobs"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 no-underline mb-6 block"
      >
        &larr; Back to Onsite Jobs
      </Link>

      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-8">Log New Support Job</h1>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={e => { setSubject(e.target.value); setSubjectError(false) }}
            className={`w-full rounded-lg border ${subjectError ? 'border-red-500' : 'border-gray-200 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="e.g. Laptop won't connect to Wi-Fi"
          />
          {subjectError && <p className="text-xs text-red-500 mt-1">Subject is required</p>}
        </div>

        {/* Who needs help? */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Person requiring assistance
          </label>
          <input
            type="text"
            value={onBehalfOf}
            onChange={e => setOnBehalfOf(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Leave blank if it's for you"
          />
        </div>

        {/* Room / Location */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Room / Location
          </label>
          <input
            type="text"
            value={roomLocation}
            onChange={e => setRoomLocation(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Room 14, Server Room, Main Office"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as OjiPriority[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  priority === p
                    ? p === 'high'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                      : p === 'medium'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                        : 'border-gray-400 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                    : 'border-gray-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a category...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            What&apos;s the issue?
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe what's happening and any relevant context..."
          />
        </div>

        {/* Preferred date/time */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Preferred date &amp; time
          </label>
          <input
            type="datetime-local"
            value={preferredDatetime}
            onChange={e => setPreferredDatetime(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">This is a preference only — it doesn&apos;t book a slot.</p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" size="sm" variant="primary" disabled={loading}>
            {loading ? 'Logging...' : 'Log Support Job'}
          </Button>
          <Link
            href="/portal/onsite-jobs"
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 no-underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
