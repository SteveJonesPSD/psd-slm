'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePortal } from '../../portal-context'

export function QuoteAcceptDecline({ quoteId }: { quoteId: string }) {
  const ctx = usePortal()
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'accept' | 'decline'>('idle')
  const [poNumber, setPoNumber] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    if (!poNumber.trim()) return
    setLoading(true)
    setError(null)

    try {
      const { acceptPortalQuote } = await import('@/lib/portal/quotes-actions')
      const result = await acceptPortalQuote(quoteId, poNumber.trim(), ctx)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleDecline() {
    setLoading(true)
    setError(null)

    try {
      const { declinePortalQuote } = await import('@/lib/portal/quotes-actions')
      const result = await declinePortalQuote(quoteId, reason.trim() || null, ctx)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'accept') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 w-full sm:w-auto sm:min-w-[280px]">
        <h3 className="text-sm font-semibold text-green-800 mb-3">Accept Quote</h3>
        <label className="block text-xs font-medium text-green-700 mb-1">Your PO Number *</label>
        <input
          type="text"
          value={poNumber}
          onChange={(e) => setPoNumber(e.target.value)}
          placeholder="e.g. PO-12345"
          className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-green-500"
          autoFocus
        />
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={loading || !poNumber.trim()}
            className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Accepting...' : 'Confirm'}
          </button>
          <button
            onClick={() => { setMode('idle'); setError(null) }}
            className="rounded-lg border border-green-300 px-3 py-2 text-sm text-green-700 hover:bg-green-100"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'decline') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 w-full sm:w-auto sm:min-w-[280px]">
        <h3 className="text-sm font-semibold text-red-800 mb-3">Decline Quote</h3>
        <label className="block text-xs font-medium text-red-700 mb-1">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Tell us why..."
          rows={2}
          className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDecline}
            disabled={loading}
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Declining...' : 'Confirm Decline'}
          </button>
          <button
            onClick={() => { setMode('idle'); setError(null) }}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => setMode('accept')}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        Accept
      </button>
      <button
        onClick={() => setMode('decline')}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Decline
      </button>
    </div>
  )
}
