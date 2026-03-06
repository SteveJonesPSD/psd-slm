'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, QUOTE_STATUS_CONFIG } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { linkQuoteToOpportunity } from '@/app/(dashboard)/pipeline/actions'
import { useRouter } from 'next/navigation'

interface LinkQuoteModalProps {
  opportunityId: string
  customerId: string
  onClose: () => void
}

interface UnlinkedQuote {
  id: string
  quote_number: string
  title: string | null
  status: string
  created_at: string
  total: number
}

export function LinkQuoteModal({ opportunityId, customerId, onClose }: LinkQuoteModalProps) {
  const router = useRouter()
  const [quotes, setQuotes] = useState<UnlinkedQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [linking, setLinking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUnlinkedQuotes() {
      const supabase = createClient()
      const { data } = await supabase
        .from('quotes')
        .select('id, quote_number, title, status, created_at, quote_lines(quantity, sell_price)')
        .eq('customer_id', customerId)
        .is('opportunity_id', null)
        .order('created_at', { ascending: false })

      if (data) {
        setQuotes(
          data.map((q) => ({
            id: q.id,
            quote_number: q.quote_number,
            title: q.title,
            status: q.status,
            created_at: q.created_at,
            total: ((q.quote_lines as { quantity: number; sell_price: number }[]) || []).reduce(
              (s, l) => s + l.quantity * l.sell_price,
              0
            ),
          }))
        )
      }
      setLoading(false)
    }
    fetchUnlinkedQuotes()
  }, [customerId])

  const filtered = quotes.filter((q) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      q.quote_number.toLowerCase().includes(s) ||
      (q.title && q.title.toLowerCase().includes(s))
    )
  })

  const handleLink = async (quoteId: string) => {
    setLinking(quoteId)
    setError(null)
    const result = await linkQuoteToOpportunity(quoteId, opportunityId)
    if (result.error) {
      setError(result.error)
      setLinking(null)
    } else {
      router.refresh()
      onClose()
    }
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-xl bg-white dark:bg-slate-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Link Existing Quote</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Search by quote number or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 mb-4"
          />

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading quotes...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              {quotes.length === 0
                ? 'No unlinked quotes found for this customer.'
                : 'No quotes match your search.'}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto -mx-1 px-1">
              <div className="space-y-2">
                {filtered.map((q) => {
                  const statusCfg = QUOTE_STATUS_CONFIG[q.status as keyof typeof QUOTE_STATUS_CONFIG]
                  return (
                    <div
                      key={q.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {q.quote_number}
                          </span>
                          {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                        </div>
                        {q.title && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{q.title}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatCurrency(q.total)} &middot; {new Date(q.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleLink(q.id)}
                        disabled={linking !== null}
                      >
                        {linking === q.id ? 'Linking...' : 'Link'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 dark:border-slate-700 px-6 py-4">
          <Button size="sm" variant="default" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
