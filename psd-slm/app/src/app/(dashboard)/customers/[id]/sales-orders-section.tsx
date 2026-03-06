'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, SO_HEADER_STATUS_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CollapsibleCard } from './collapsible-card'

interface SoRow {
  id: string
  so_number: string
  display_status: string
  customer_po: string | null
  created_at: string
  assigned_user: { first_name: string; last_name: string; initials: string | null; color: string | null } | null
  line_count: number
  total: number
  opportunity_title: string | null
}

interface SalesOrdersSectionProps {
  salesOrders: SoRow[]
}

export function SalesOrdersSection({ salesOrders }: SalesOrdersSectionProps) {
  const router = useRouter()

  const columns: Column<SoRow>[] = [
    {
      key: 'so_number',
      label: 'SO #',
      nowrap: true,
      render: (r) => <span className="font-semibold">{r.so_number}</span>,
    },
    {
      key: 'opportunity_title',
      label: 'Opportunity',
      render: (r) => r.opportunity_title || '\u2014',
    },
    {
      key: 'customer_po',
      label: 'Customer PO',
      nowrap: true,
      render: (r) => r.customer_po || '\u2014',
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (r) =>
        r.assigned_user ? (
          <Avatar
            user={{
              first_name: r.assigned_user.first_name,
              last_name: r.assigned_user.last_name,
              initials: r.assigned_user.initials,
              color: r.assigned_user.color,
            }}
            size={24}
          />
        ) : null,
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r) => {
        const cfg = SO_HEADER_STATUS_CONFIG[r.display_status]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.display_status
      },
    },
    {
      key: 'lines',
      label: 'Lines',
      align: 'center',
      nowrap: true,
      render: (r) => r.line_count,
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      nowrap: true,
      render: (r) => <span className="font-semibold">{formatCurrency(r.total)}</span>,
    },
    {
      key: 'created_at',
      label: 'Date',
      nowrap: true,
      render: (r) => formatDate(r.created_at),
    },
  ]

  return (
    <CollapsibleCard title="Sales Orders" count={salesOrders.length}>
      <DataTable
        columns={columns}
        data={salesOrders}
        onRowClick={(r) => router.push(`/orders/${r.id}`)}
        emptyMessage="No sales orders yet."
      />
    </CollapsibleCard>
  )
}
