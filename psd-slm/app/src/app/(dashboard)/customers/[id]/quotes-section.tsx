'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, QUOTE_STATUS_CONFIG, QUOTE_TYPE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatCurrency } from '@/lib/utils'

interface QuoteRow {
  id: string
  quote_number: string
  status: string
  quote_type: string | null
  vat_rate: number
  version: number
  users: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
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
      render: (r) => `v${r.version}`,
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <h3 className="text-[15px] font-semibold mb-3">
        Quotes ({quotes.length})
      </h3>
      <DataTable
        columns={columns}
        data={quotes}
        onRowClick={(r) => router.push(`/quotes/${r.id}`)}
        emptyMessage="No quotes yet."
      />
    </div>
  )
}
