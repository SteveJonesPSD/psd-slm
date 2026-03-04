'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, DN_STATUS_CONFIG } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface DnRow {
  id: string
  dn_number: string
  status: string
  carrier: string | null
  tracking_reference: string | null
  created_at: string
  sales_orders: {
    id: string
    so_number: string
    customer_id: string
    customers: { id: string; name: string } | null
  } | null
  delivery_note_lines: { id: string; quantity: number }[]
  creator: { id: string; first_name: string; last_name: string } | null
}

interface DeliveryNotesTableProps {
  deliveryNotes: DnRow[]
}

export function DeliveryNotesTable({ deliveryNotes }: DeliveryNotesTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    let result = deliveryNotes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        d => d.dn_number.toLowerCase().includes(q) ||
          d.sales_orders?.so_number.toLowerCase().includes(q) ||
          d.sales_orders?.customers?.name.toLowerCase().includes(q) ||
          d.carrier?.toLowerCase().includes(q) ||
          d.tracking_reference?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter(d => d.status === statusFilter)
    }
    return result
  }, [deliveryNotes, search, statusFilter])

  const columns: Column<DnRow>[] = [
    {
      key: 'dn_number',
      label: 'DN #',
      nowrap: true,
      render: (r) => <span className="font-semibold">{r.dn_number}</span>,
    },
    {
      key: 'so_number',
      label: 'SO #',
      nowrap: true,
      render: (r) =>
        r.sales_orders ? (
          <Link
            href={`/orders/${r.sales_orders.id}`}
            className="text-blue-600 hover:underline no-underline"
            onClick={e => e.stopPropagation()}
          >
            {r.sales_orders.so_number}
          </Link>
        ) : '\u2014',
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => r.sales_orders?.customers?.name || '',
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r) => {
        const cfg = DN_STATUS_CONFIG[r.status]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.status
      },
    },
    {
      key: 'lines',
      label: 'Lines',
      align: 'center',
      nowrap: true,
      render: (r) => r.delivery_note_lines?.length || 0,
    },
    {
      key: 'carrier',
      label: 'Carrier',
      nowrap: true,
      render: (r) => r.carrier || '\u2014',
    },
    {
      key: 'tracking',
      label: 'Tracking',
      nowrap: true,
      render: (r) => r.tracking_reference || '\u2014',
    },
    {
      key: 'created',
      label: 'Created',
      nowrap: true,
      render: (r) => formatDate(r.created_at),
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="text"
          placeholder="Search delivery notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Statuses</option>
          {Object.entries(DN_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/delivery-notes/${r.id}`)}
        emptyMessage="No delivery notes found."
      />
    </div>
  )
}
