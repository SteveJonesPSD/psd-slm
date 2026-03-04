'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, QUOTE_STATUS_CONFIG, QUOTE_TYPE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency } from '@/lib/utils'
import { getMarginColor } from '@/lib/margin'
import { deleteQuote, markQuoteAsLost } from './actions'
import { LOST_REASONS } from '@/lib/opportunities'

interface QuoteRow {
  id: string
  quote_number: string
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

interface QuotesTableProps {
  quotes: QuoteRow[]
}

export function QuotesTable({ quotes }: QuotesTableProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all')
  const [showRevised, setShowRevised] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [lostModal, setLostModal] = useState<{ id: string; quoteNumber: string } | null>(null)
  const [lostReason, setLostReason] = useState('')

  const handleMarkAsLost = useCallback(async () => {
    if (!lostModal || !lostReason) return
    setActionLoading(lostModal.id)
    setLostModal(null)
    await markQuoteAsLost(lostModal.id, lostReason)
    setLostReason('')
    router.refresh()
    setActionLoading(null)
  }, [lostModal, lostReason, router])

  const filtered = useMemo(() => {
    let result = quotes
    // Hide revised quotes by default
    if (!showRevised) {
      result = result.filter((r) => r.status !== 'revised')
    }
    if (ownerFilter === 'mine' && user) {
      result = result.filter((r) => r.assigned_to === user.id)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.quote_number.toLowerCase().includes(q) ||
          r.customers?.name.toLowerCase().includes(q) ||
          r.opportunities?.title.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter)
    }
    if (typeFilter) {
      result = result.filter((r) => r.quote_type === typeFilter)
    }
    return result
  }, [quotes, search, statusFilter, typeFilter, ownerFilter, showRevised, user])

  const columns: Column<QuoteRow>[] = [
    {
      key: 'quote_number',
      label: 'Quote #',
      nowrap: true,
      render: (r) => <span className="font-semibold">{r.quote_number}</span>,
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => r.customers?.name || '',
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (r) =>
        r.users ? (
          <Avatar
            user={{
              first_name: r.users.first_name,
              last_name: r.users.last_name,
              initials: r.users.initials,
              color: r.users.color,
            }}
            size={24}
          />
        ) : null,
    },
    {
      key: 'type',
      label: 'Type',
      nowrap: true,
      render: (r) => {
        if (!r.quote_type) return null
        const cfg = QUOTE_TYPE_CONFIG[r.quote_type as keyof typeof QUOTE_TYPE_CONFIG]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : null
      },
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r) => {
        const cfg = QUOTE_STATUS_CONFIG[r.status as keyof typeof QUOTE_STATUS_CONFIG]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.status
      },
    },
    {
      key: 'lines',
      label: 'Lines',
      align: 'center',
      nowrap: true,
      render: (r) => r.quote_lines?.length || 0,
    },
    {
      key: 'margin',
      label: 'Margin',
      align: 'right',
      nowrap: true,
      render: (r) => {
        const lines = r.quote_lines || []
        const revenue = lines.reduce((s, l) => s + l.sell_price * l.quantity, 0)
        const cost = lines.reduce((s, l) => s + l.buy_price * l.quantity, 0)
        if (revenue <= 0) return '\u2014'
        const margin = revenue - cost
        const pct = (margin / revenue) * 100
        const color = getMarginColor(cost / (lines.reduce((s, l) => s + l.quantity, 0) || 1), revenue / (lines.reduce((s, l) => s + l.quantity, 0) || 1))
        return (
          <span className={`font-medium ${color}`}>
            {formatCurrency(margin)} ({pct.toFixed(1)}%)
          </span>
        )
      },
    },
    {
      key: 'total',
      label: 'Quote Value',
      align: 'right',
      nowrap: true,
      render: (r) => {
        const subtotal = (r.quote_lines || []).reduce(
          (s, l) => s + l.sell_price * l.quantity,
          0
        )
        return (
          <span className="font-semibold">
            {formatCurrency(subtotal * (1 + r.vat_rate / 100))}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: '',
      align: 'center',
      nowrap: true,
      render: (r) => {
        if (r.status === 'draft') {
          return (
            <button
              title="Delete draft"
              disabled={actionLoading === r.id}
              onClick={async (e) => {
                e.stopPropagation()
                if (!window.confirm(`Delete draft quote ${r.quote_number}?`)) return
                setActionLoading(r.id)
                await deleteQuote(r.id)
                router.refresh()
                setActionLoading(null)
              }}
              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
          )
        }
        if (r.status === 'sent') {
          return (
            <button
              title="Mark as lost"
              disabled={actionLoading === r.id}
              onClick={(e) => {
                e.stopPropagation()
                setLostReason('')
                setLostModal({ id: r.id, quoteNumber: r.quote_number })
              }}
              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
              </svg>
            </button>
          )
        }
        return null
      },
    },
  ]

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search quotes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:flex-1 sm:max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value as 'all' | 'mine')}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="all">All Quotes</option>
          <option value="mine">My Quotes</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Statuses</option>
          {Object.entries(QUOTE_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Types</option>
          {Object.entries(QUOTE_TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showRevised}
            onChange={(e) => setShowRevised(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show revised
        </label>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/quotes/${r.id}`)}
        emptyMessage="No quotes found."
      />

      {/* Mark as Lost modal */}
      {lostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setLostModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Mark as Lost</h3>
            <p className="text-sm text-slate-500 mb-4">
              Mark quote <span className="font-medium text-slate-700">{lostModal.quoteNumber}</span> as lost?
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <select
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 mb-4"
            >
              <option value="">Select a reason...</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setLostModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={!lostReason}
                onClick={handleMarkAsLost}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark as Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
