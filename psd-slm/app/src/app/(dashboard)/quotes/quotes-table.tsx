'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, QUOTE_STATUS_CONFIG, QUOTE_TYPE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency } from '@/lib/utils'
import { getMarginColor } from '@/lib/margin'

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
      render: (r) => {
        if (!r.quote_type) return null
        const cfg = QUOTE_TYPE_CONFIG[r.quote_type as keyof typeof QUOTE_TYPE_CONFIG]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : null
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const cfg = QUOTE_STATUS_CONFIG[r.status as keyof typeof QUOTE_STATUS_CONFIG]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.status
      },
    },
    {
      key: 'lines',
      label: 'Lines',
      align: 'center',
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
  ]

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search quotes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value as 'all' | 'mine')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="all">All Quotes</option>
          <option value="mine">My Quotes</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Statuses</option>
          {Object.entries(QUOTE_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
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
    </div>
  )
}
