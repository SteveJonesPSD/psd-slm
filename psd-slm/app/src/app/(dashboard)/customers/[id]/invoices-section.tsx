'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, INVOICE_STATUS_CONFIG } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CollapsibleCard } from './collapsible-card'

interface InvoiceRow {
  id: string
  invoice_number: string
  status: string
  effective_status: string
  invoice_type: string
  total: number
  created_at: string
  due_date: string | null
  paid_at: string | null
  so_number: string | null
}

interface InvoicesSectionProps {
  invoices: InvoiceRow[]
}

export function InvoicesSection({ invoices }: InvoicesSectionProps) {
  const router = useRouter()

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      nowrap: true,
      render: (r) => <span className="font-semibold">{r.invoice_number}</span>,
    },
    {
      key: 'so_number',
      label: 'SO #',
      nowrap: true,
      render: (r) => r.so_number || '\u2014',
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r) => {
        const key = r.effective_status || r.status
        const cfg = INVOICE_STATUS_CONFIG[key]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : key
      },
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      nowrap: true,
      render: (r) => <span className="font-semibold">{formatCurrency(r.total)}</span>,
    },
    {
      key: 'due_date',
      label: 'Due',
      nowrap: true,
      render: (r) => r.due_date ? formatDate(r.due_date) : '\u2014',
    },
    {
      key: 'created_at',
      label: 'Date',
      nowrap: true,
      render: (r) => formatDate(r.created_at),
    },
  ]

  return (
    <CollapsibleCard title="Invoices" count={invoices.length}>
      <DataTable
        columns={columns}
        data={invoices}
        onRowClick={(r) => router.push(`/invoices/${r.id}`)}
        emptyMessage="No invoices yet."
      />
    </CollapsibleCard>
  )
}
