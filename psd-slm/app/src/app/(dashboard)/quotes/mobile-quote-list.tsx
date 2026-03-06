'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, QUOTE_STATUS_CONFIG, QUOTE_TYPE_CONFIG } from '@/components/ui/badge'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency } from '@/lib/utils'
import { getMarginColor, DEFAULT_MARGIN_GREEN, DEFAULT_MARGIN_AMBER } from '@/lib/margin'
import { MobileQuoteFilters } from './mobile-quote-filters'

interface QuoteRow {
  id: string
  quote_number: string
  title: string | null
  status: string
  quote_type: string | null
  vat_rate: number
  assigned_to: string | null
  created_at: string
  customers: { name: string } | null
  users: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
  quote_lines: { quantity: number; sell_price: number; buy_price: number }[]
  opportunities: { id: string; title: string } | null
}

interface MobileQuoteListProps {
  quotes: QuoteRow[]
  marginThresholds?: { green: number; amber: number }
}

export function MobileQuoteList({ quotes, marginThresholds }: MobileQuoteListProps) {
  const greenT = marginThresholds?.green ?? DEFAULT_MARGIN_GREEN
  const amberT = marginThresholds?.amber ?? DEFAULT_MARGIN_AMBER
  const router = useRouter()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all')
  const [showRevised, setShowRevised] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let result = quotes
    if (!showRevised) {
      result = result.filter(r => r.status !== 'revised')
    }
    if (ownerFilter === 'mine' && user) {
      result = result.filter(r => r.assigned_to === user.id)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.quote_number.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        r.customers?.name.toLowerCase().includes(q) ||
        r.opportunities?.title.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter)
    }
    if (typeFilter) {
      result = result.filter(r => r.quote_type === typeFilter)
    }
    return result
  }, [quotes, search, statusFilter, typeFilter, ownerFilter, showRevised, user])

  const hasActiveFilters = !!(search || statusFilter || typeFilter || ownerFilter === 'mine' || showRevised)

  // Stats
  const stats = useMemo(() => {
    const active = quotes.filter(q => !['revised', 'lost', 'declined'].includes(q.status))
    const draftCount = quotes.filter(q => q.status === 'draft').length
    const sentCount = quotes.filter(q => q.status === 'sent').length
    const acceptedCount = quotes.filter(q => q.status === 'accepted').length
    const totalValue = active.reduce((sum, q) => {
      const subtotal = (q.quote_lines || []).reduce((s, l) => s + l.sell_price * l.quantity, 0)
      return sum + subtotal * (1 + q.vat_rate / 100)
    }, 0)
    return { draftCount, sentCount, acceptedCount, totalValue }
  }, [quotes])

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setTypeFilter('')
    setOwnerFilter('all')
    setShowRevised(false)
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">All Quotes</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/quotes/new"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white no-underline active:bg-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New
          </Link>
          <button
            onClick={() => setShowFilters(true)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'border-gray-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
            }`}
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5">
        <StatPill label="Draft" value={stats.draftCount} color="#6366f1" />
        <StatPill label="Sent" value={stats.sentCount} color="#2563eb" />
        <StatPill label="Won" value={stats.acceptedCount} color="#059669" />
        <StatPill label="Pipeline" value={formatCurrency(stats.totalValue)} color="#1e293b" />
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {search && <FilterChip label={`"${search}"`} onDismiss={() => setSearch('')} />}
          {statusFilter && (
            <FilterChip
              label={QUOTE_STATUS_CONFIG[statusFilter as keyof typeof QUOTE_STATUS_CONFIG]?.label || statusFilter}
              onDismiss={() => setStatusFilter('')}
            />
          )}
          {typeFilter && (
            <FilterChip
              label={QUOTE_TYPE_CONFIG[typeFilter as keyof typeof QUOTE_TYPE_CONFIG]?.label || typeFilter}
              onDismiss={() => setTypeFilter('')}
            />
          )}
          {ownerFilter === 'mine' && <FilterChip label="My Quotes" onDismiss={() => setOwnerFilter('all')} />}
          {showRevised && <FilterChip label="Inc. revised" onDismiss={() => setShowRevised(false)} />}
        </div>
      )}

      {/* Quote cards */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">No quotes found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(quote => {
            const statusCfg = QUOTE_STATUS_CONFIG[quote.status as keyof typeof QUOTE_STATUS_CONFIG]
            const typeCfg = quote.quote_type ? QUOTE_TYPE_CONFIG[quote.quote_type as keyof typeof QUOTE_TYPE_CONFIG] : null
            const lines = quote.quote_lines || []
            const subtotal = lines.reduce((s, l) => s + l.sell_price * l.quantity, 0)
            const cost = lines.reduce((s, l) => s + l.buy_price * l.quantity, 0)
            const total = subtotal * (1 + quote.vat_rate / 100)
            const marginPct = subtotal > 0 ? ((subtotal - cost) / subtotal) * 100 : 0
            const marginColor = subtotal > 0 ? getMarginColor(cost / (lines.reduce((s, l) => s + l.quantity, 0) || 1), subtotal / (lines.reduce((s, l) => s + l.quantity, 0) || 1), greenT, amberT) : 'text-slate-400'

            return (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="block rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 no-underline active:bg-gray-50 dark:active:bg-slate-700 transition-colors"
              >
                {/* Row 1: quote number + status + type */}
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{quote.quote_number}</span>
                    {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
                  </div>
                  {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                </div>

                {/* Row 2: title + customer */}
                {quote.title && (
                  <div className="mb-0.5 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{quote.title}</div>
                )}
                <div className="mb-1.5 text-sm text-slate-700 dark:text-slate-300 truncate">
                  {quote.customers?.name || 'No customer'}
                </div>

                {/* Row 3: value + margin + owner */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(total)}</span>
                    {subtotal > 0 && (
                      <span className={`font-medium ${marginColor}`}>{marginPct.toFixed(1)}%</span>
                    )}
                    <span className="text-slate-400 dark:text-slate-500">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
                  </div>
                  {quote.users && (
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: quote.users.color || '#6366f1' }}
                      title={`${quote.users.first_name} ${quote.users.last_name}`}
                    >
                      {quote.users.initials || '?'}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Count footer */}
      <div className="mt-3 text-xs text-slate-400 dark:text-slate-500 text-center">
        {filtered.length} quote{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Filter sheet */}
      <MobileQuoteFilters
        open={showFilters}
        onClose={() => setShowFilters(false)}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        ownerFilter={ownerFilter}
        setOwnerFilter={setOwnerFilter}
        showRevised={showRevised}
        setShowRevised={setShowRevised}
        onApply={() => {}}
        onClear={clearFilters}
      />
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium"
      style={{ backgroundColor: `${color}12`, color }}
    >
      <span className="text-base font-bold leading-none">{value}</span>
      {label}
    </div>
  )
}

function FilterChip({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
      {label}
      <button onClick={onDismiss} className="ml-0.5 text-indigo-400 hover:text-indigo-600 dark:text-indigo-500">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}
