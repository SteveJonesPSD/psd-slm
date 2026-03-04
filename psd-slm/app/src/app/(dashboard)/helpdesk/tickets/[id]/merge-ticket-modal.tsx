'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'
import { getMergeableTickets, mergeTickets } from '../../actions'

interface MergeableTicket {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  created_at: string
}

interface MergeTicketModalProps {
  ticketId: string
  ticketNumber: string
  customerId: string
  onClose: () => void
}

export function MergeTicketModal({ ticketId, ticketNumber, customerId, onClose }: MergeTicketModalProps) {
  const router = useRouter()
  const [tickets, setTickets] = useState<MergeableTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'confirm'>('select')
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const result = await getMergeableTickets(ticketId, customerId)
      if (result.data) setTickets(result.data as MergeableTicket[])
      setLoading(false)
    }
    load()
  }, [ticketId, customerId])

  const filtered = tickets.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.ticket_number.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
  })

  const selectedTicket = tickets.find(t => t.id === selectedId)

  // Determine which is source vs target based on ticket number
  function getDirection() {
    if (!selectedTicket) return null
    const currentNum = parseInt(ticketNumber.replace(/\D/g, ''), 10)
    const otherNum = parseInt(selectedTicket.ticket_number.replace(/\D/g, ''), 10)
    if (currentNum < otherNum) {
      return { source: ticketNumber, target: selectedTicket.ticket_number, targetId: selectedTicket.id }
    } else {
      return { source: selectedTicket.ticket_number, target: ticketNumber, targetId: ticketId }
    }
  }

  async function handleMerge() {
    if (!selectedId) return
    setMerging(true)
    setError(null)

    const result = await mergeTickets(ticketId, selectedId)

    if (result.error) {
      setError(result.error)
      setMerging(false)
      return
    }

    // Navigate to the target ticket
    if (result.targetTicketId) {
      router.push(`/helpdesk/tickets/${result.targetTicketId}`)
    }
    onClose()
  }

  const direction = getDirection()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <h3 className="text-lg font-semibold text-slate-900">
              {step === 'select' ? 'Merge Ticket' : 'Confirm Merge'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'select' ? (
          <div className="px-6 py-4">
            <p className="text-sm text-slate-600 mb-3">
              Select a ticket from the same customer to merge with <span className="font-semibold">{ticketNumber}</span>.
              The newer ticket will remain open; the older one will be closed.
            </p>

            {/* Search */}
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 mb-3"
              autoFocus
            />

            {/* Ticket list */}
            <div className="max-h-72 overflow-y-auto space-y-1">
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-400">Loading tickets...</div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No eligible tickets found for this customer.</div>
              ) : (
                filtered.map(t => {
                  const statusCfg = TICKET_STATUS_CONFIG[t.status]
                  const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority]
                  const isSelected = selectedId === t.id

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(isSelected ? null : t.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        isSelected
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-gray-100 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">{t.ticket_number}</span>
                        <div className="flex items-center gap-1">
                          {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                          {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{t.subject}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="px-6 py-4">
            {direction && (
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">{direction.source}</span> (older) will be closed and merged into{' '}
                    <span className="font-semibold">{direction.target}</span> (newer, stays open).
                  </p>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <p>This will:</p>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li>Close the older ticket and mark it as merged</li>
                    <li>Show the older ticket&apos;s conversation on the live ticket</li>
                    <li>Copy tags and watchers to the live ticket</li>
                    <li>Notify the older ticket&apos;s assignee and watchers</li>
                    <li>Redirect the customer&apos;s old magic link to the live ticket</li>
                  </ul>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          {step === 'confirm' && (
            <button
              onClick={() => { setStep('select'); setError(null) }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50"
              disabled={merging}
            >
              Back
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50"
            disabled={merging}
          >
            Cancel
          </button>
          {step === 'select' ? (
            <button
              onClick={() => setStep('confirm')}
              disabled={!selectedId}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleMerge}
              disabled={merging}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {merging ? 'Merging...' : 'Merge Tickets'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
