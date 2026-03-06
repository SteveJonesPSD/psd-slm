'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignTicketToCustomer } from '@/lib/helpdesk/assignment-actions'

interface CustomerOption {
  customer_id: string
  customer_name: string
  is_primary: boolean
}

interface CustomerAssignmentBannerProps {
  ticketId: string
  contactName: string | null
  senderEmail: string | null
  assignmentOptions: CustomerOption[]
}

export function CustomerAssignmentBanner({
  ticketId,
  contactName,
  senderEmail,
  assignmentOptions,
}: CustomerAssignmentBannerProps) {
  const router = useRouter()
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState('')

  const hasOptions = assignmentOptions.length > 0

  async function handleSearch(query: string) {
    setCustomerSearch(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.customers || [])
      }
    } catch {
      // best-effort
    } finally {
      setSearching(false)
    }
  }

  async function handleAssign() {
    if (!selectedCustomerId) return
    setAssigning(true)
    setError('')
    const result = await assignTicketToCustomer(ticketId, selectedCustomerId)
    if (result.error) {
      setError(result.error)
      setAssigning(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800">
          <svg className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {hasOptions ? (
            <>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                Multi-Customer Contact
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                {contactName || 'This contact'} ({senderEmail}) is linked to multiple customers. Please assign this ticket to the correct customer.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {assignmentOptions.map(opt => (
                  <button
                    key={opt.customer_id}
                    onClick={() => setSelectedCustomerId(opt.customer_id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selectedCustomerId === opt.customer_id
                        ? 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-800 dark:text-amber-100 dark:border-amber-400'
                        : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.customer_name}
                    {opt.is_primary && (
                      <span className="rounded-full bg-amber-200 dark:bg-amber-700 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-200">
                        Primary
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                Unknown Sender
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                This ticket was raised by <strong>{senderEmail || 'an unknown sender'}</strong>. No matching domain or contact was found. Please assign to a customer.
              </p>
              <div className="mb-3">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search customers..."
                  className="w-full sm:w-80 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:bg-slate-800 dark:border-amber-600 dark:text-slate-200"
                />
                {searching && <span className="ml-2 text-xs text-amber-600">Searching...</span>}
                {searchResults.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {searchResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); setSearchResults([]) }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selectedCustomerId === c.id
                            ? 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <button
            onClick={handleAssign}
            disabled={!selectedCustomerId || assigning}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {assigning ? 'Assigning...' : 'Assign to Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}
