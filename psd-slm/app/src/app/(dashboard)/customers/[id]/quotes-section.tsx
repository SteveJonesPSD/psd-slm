'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, QUOTE_STATUS_CONFIG, QUOTE_TYPE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatCurrency } from '@/lib/utils'
import { CollapsibleCard } from './collapsible-card'

interface QuoteRow {
  id: string
  quote_number: string
  status: string
  quote_type: string | null
  vat_rate: number
  version: number
  revision_notes: string | null
  users: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
  title: string | null
  quote_lines: { quantity: number; sell_price: number }[]
}

interface QuotesSectionProps {
  quotes: QuoteRow[]
}

export function QuotesSection({ quotes }: QuotesSectionProps) {
  const router = useRouter()

  const columns: Column<QuoteRow>[] = [
    {
      key: 'quote_number',
      label: 'Quote #',
      nowrap: true,
      render: (r) => <span className="font-semibold">{r.quote_number}</span>,
    },
    {
      key: 'title',
      label: 'Description',
      render: (r) => r.title || '\u2014',
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
      key: 'version',
      label: 'Ver.',
      align: 'center',
      nowrap: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          v{r.version}
          {r.revision_notes && (
            <span className="group relative">
              <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-pre-wrap rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100 max-w-xs w-max">
                {r.revision_notes}
              </span>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'lines',
      label: 'Lines',
      align: 'center',
      nowrap: true,
      render: (r) => r.quote_lines?.length || 0,
    },
    {
      key: 'total',
      label: 'Total (inc VAT)',
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
    <CollapsibleCard title="Quotes" count={quotes.length}>
      <DataTable
        columns={columns}
        data={quotes}
        onRowClick={(r) => router.push(`/quotes/${r.id}`)}
        emptyMessage="No quotes yet."
      />
    </CollapsibleCard>
  )
}
