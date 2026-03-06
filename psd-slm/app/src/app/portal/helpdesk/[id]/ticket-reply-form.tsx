'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePortal } from '../../portal-context'

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const ctx = usePortal()
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError(null)

    try {
      const { addPortalMessage } = await import('@/lib/portal/helpdesk-actions')
      const result = await addPortalMessage(ticketId, content.trim(), ctx)
      if (result.error) {
        setError(result.error)
      } else {
        setContent('')
        router.refresh()
      }
    } catch {
      setError('Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your reply..."
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending...' : 'Send Reply'}
        </button>
      </div>
    </form>
  )
}
