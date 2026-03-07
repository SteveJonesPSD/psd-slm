'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function TicketClosePage() {
  const params = useParams()
  const token = params.token as string
  const [status, setStatus] = useState<'confirm' | 'closing' | 'closed' | 'already' | 'error'>('confirm')
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)

  async function handleClose() {
    setStatus('closing')
    try {
      const res = await fetch('/api/tickets/portal-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()

      if (data.closed) {
        setTicketNumber(data.ticketNumber)
        setStatus('closed')
      } else if (data.alreadyClosed) {
        setTicketNumber(data.ticketNumber)
        setStatus('already')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {status === 'confirm' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Close This Ticket?</h1>
            <p className="text-sm text-slate-500 mb-6">
              If your issue has been resolved, you can close this support ticket. You won&apos;t be able to reply once it&apos;s closed, but you can always open a new ticket if you need further help.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleClose}
                className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Yes, Close My Ticket
              </button>
              <a
                href={`/t/${token}`}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors text-center no-underline"
              >
                No, I Still Need Help
              </a>
            </div>
          </div>
        )}

        {status === 'closing' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
            <p className="text-sm text-slate-500">Closing your ticket...</p>
          </div>
        )}

        {status === 'closed' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Ticket Closed</h1>
            <p className="text-sm text-slate-500">
              {ticketNumber ? `${ticketNumber} has` : 'Your ticket has'} been closed. Thank you for letting us know. If you need help in the future, don&apos;t hesitate to get in touch.
            </p>
          </div>
        )}

        {status === 'already' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Already Closed</h1>
            <p className="text-sm text-slate-500">
              {ticketNumber ? `${ticketNumber} is` : 'This ticket is'} already closed. No further action is needed.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-4">
              We couldn&apos;t close this ticket. The link may have expired or the ticket may not exist.
            </p>
            <a
              href={`/t/${token}`}
              className="inline-block rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50 no-underline"
            >
              View Ticket
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
