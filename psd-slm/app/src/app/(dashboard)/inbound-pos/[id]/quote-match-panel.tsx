'use client'

import { useState, useCallback } from 'react'
import { Badge, QUOTE_STATUS_CONFIG, MATCH_CONFIDENCE_CONFIG } from '@/components/ui/badge'
import { manualMatchQuote, unmatchQuote, searchQuotesForMatch } from '../actions'

interface QuoteMatchPanelProps {
  inboundPoId: string
  matchedQuoteId: string | null
  matchedQuote: {
    id: string
    quote_number: string
    status: string
    customers: { name: string }
  } | null
  matchConfidence: string | null
  matchMethod: string | null
  onMatchChanged: () => void
}

const formatCurrency = (val: number | null) => {
  if (val === null || val === undefined) return '\u2014'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(val)
}

export function QuoteMatchPanel({
  inboundPoId,
  matchedQuoteId,
  matchedQuote,
  matchConfidence,
  matchMethod,
  onMatchChanged,
}: QuoteMatchPanelProps) {
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{
    id: string
    quote_number: string
    status: string
    customers: unknown
    total: number
  }[]>([])
  const [searching, setSearching] = useState(false)
  const [processing, setProcessing] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const result = await searchQuotesForMatch(searchQuery)
    if (result.data) {
      setSearchResults(result.data)
    }
    setSearching(false)
  }, [searchQuery])

  const handleManualMatch = async (quoteId: string) => {
    setProcessing(true)
    await manualMatchQuote(inboundPoId, quoteId)
    setSearchMode(false)
    setSearchResults([])
    setProcessing(false)
    onMatchChanged()
  }

  const handleUnmatch = async () => {
    setProcessing(true)
    await unmatchQuote(inboundPoId)
    setProcessing(false)
    onMatchChanged()
  }

  const confidenceLabel = matchConfidence ? MATCH_CONFIDENCE_CONFIG[matchConfidence] : null
  const methodLabels: Record<string, string> = {
    reference: 'Quote reference found in PO',
    reference_company_mismatch: 'Quote reference found (company name differs)',
    company_value: 'Matched by company + value',
    company_only: 'Matched by company only',
    manual: 'Manually matched',
  }

  // Matched state
  if (matchedQuoteId && matchedQuote && !searchMode) {
    const quoteStatusConfig = QUOTE_STATUS_CONFIG[matchedQuote.status as keyof typeof QUOTE_STATUS_CONFIG]

    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Quote Match</h3>
          {confidenceLabel && <Badge {...confidenceLabel} />}
        </div>

        <div className="p-4">
          {/* Matched quote card */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-900">
                {matchedQuote.quote_number}
              </span>
              {quoteStatusConfig && <Badge {...quoteStatusConfig} />}
            </div>
            <p className="text-sm text-slate-600">
              {(matchedQuote.customers as { name: string })?.name || '\u2014'}
            </p>
            {matchMethod && (
              <p className="text-xs text-slate-400 mt-1">
                {methodLabels[matchMethod] || matchMethod}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSearchMode(true)}
              disabled={processing}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Change Match
            </button>
            <button
              onClick={handleUnmatch}
              disabled={processing}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {processing ? 'Removing...' : 'Remove Match'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Search / no match state
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">Quote Match</h3>
        {searchMode && (
          <button
            onClick={() => {
              setSearchMode(false)
              setSearchResults([])
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="p-4">
        {!matchedQuoteId && !searchMode && (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400 mb-3">
              No quote matched automatically.
            </p>
            <button
              onClick={() => setSearchMode(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Search for Quote
            </button>
          </div>
        )}

        {searchMode && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by quote number, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {searchResults.map((q) => {
                  const customer = q.customers as { name: string } | null
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleManualMatch(q.id)}
                      disabled={processing}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-sm font-medium text-slate-800">
                          {q.quote_number}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">
                          {customer?.name || '\u2014'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatCurrency(q.total)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-xs text-slate-400 text-center py-2">
                No quotes found.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
