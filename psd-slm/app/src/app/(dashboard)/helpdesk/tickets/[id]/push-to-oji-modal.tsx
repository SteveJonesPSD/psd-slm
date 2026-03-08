'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { OnsiteJobCategory, OjiPriority } from '@/lib/onsite-jobs/types'
import { pushTicketToOji } from '@/app/(dashboard)/helpdesk/onsite-jobs/actions'

interface PushToOjiModalProps {
  ticketId: string
  ticketSubject: string
  ticketDescription: string | null
  ticketPriority: string
  categories: OnsiteJobCategory[]
  onClose: () => void
}

const TICKET_TO_OJI_PRIORITY: Record<string, OjiPriority> = {
  urgent: 'high',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

export function PushToOjiModal({ ticketId, ticketSubject, ticketDescription, ticketPriority, categories, onClose }: PushToOjiModalProps) {
  const router = useRouter()
  const [subject, setSubject] = useState(ticketSubject)
  const [description, setDescription] = useState(ticketDescription || '')
  const [roomLocation, setRoomLocation] = useState('')
  const [priority, setPriority] = useState<OjiPriority>(TICKET_TO_OJI_PRIORITY[ticketPriority] || 'medium')
  const [categoryId, setCategoryId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ refNumber: string; id: string } | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const result = await pushTicketToOji({
      ticket_id: ticketId,
      subject: subject.trim(),
      description: description.trim() || undefined,
      room_location: roomLocation.trim() || undefined,
      priority,
      category_id: categoryId || undefined,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess({ refNumber: result.data!.ref_number, id: result.data!.id })
    setLoading(false)
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-6 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Pushed to Onsite Jobs</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Ticket closed and OJI created: <strong>{success.refNumber}</strong></p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button size="sm" variant="default" onClick={() => { onClose(); router.refresh() }}>Close</Button>
            <Button size="sm" variant="primary" onClick={() => router.push(`/helpdesk/onsite-jobs/${success.id}`)}>View OJI</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Push to Onsite Jobs</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          This will close the ticket and add it to the customer&apos;s onsite job list for their next visit.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room / Location</label>
            <input
              type="text"
              value={roomLocation}
              onChange={e => setRoomLocation(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Room 14, Server Room"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as OjiPriority)}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            {categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <Button size="sm" variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={handleSubmit} disabled={loading || !subject.trim()}>
            Push to Onsite Jobs
          </Button>
        </div>
      </div>
    </div>
  )
}
