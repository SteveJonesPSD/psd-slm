'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePortal } from '../../portal-context'

export default function PortalNewTicketPage() {
  const ctx = usePortal()
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch categories via existing portal actions API
    fetch('/api/portal/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data)
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) return

    setLoading(true)
    setError(null)

    try {
      const { createPortalTicket } = await import('@/lib/portal/helpdesk-actions')
      const result = await createPortalTicket(subject.trim(), description.trim(), categoryId, ctx)
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/portal/helpdesk/${result.ticketId}`)
      }
    } catch {
      setError('Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Link href="/portal/helpdesk" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6">
        &larr; Support
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Raise a Support Ticket</h1>
        <p className="mt-1 text-sm text-slate-500">Describe your issue and our team will get back to you</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
          </div>

          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={categoryId || ''}
                onChange={(e) => setCategoryId(e.target.value || null)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide as much detail as possible..."
              rows={6}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/portal/helpdesk"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 no-underline"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !subject.trim() || !description.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}
