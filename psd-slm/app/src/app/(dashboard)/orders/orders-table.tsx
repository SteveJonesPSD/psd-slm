'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, SO_HEADER_STATUS_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SoDisplayStatus } from '@/lib/sales-orders'

interface OrderRow {
  id: string
  so_number: string
  quote_number: string | null
  customer_po: string | null
  assigned_to: string | null
  requested_delivery_date: string | null
  requires_install: boolean
  customer_id: string
  contact_id: string | null
  delivery_address_line1: string | null
  delivery_address_line2: string | null
  delivery_city: string | null
  delivery_postcode: string | null
  install_notes: string | null
  created_at: string
  derivedStatus: SoDisplayStatus
  customers: { id: string; name: string } | null
  users: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
  sales_order_lines: { id: string; status: string; quantity: number; buy_price: number; sell_price: number }[]
  linked_job: { id: string; job_number: string; status: string } | null
}

interface OrdersTableProps {
  orders: OrderRow[]
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all')
  const [showInvoiced, setShowInvoiced] = useState(false)

  const filtered = useMemo(() => {
    let result = orders
    if (!showInvoiced) {
      result = result.filter((r) => r.derivedStatus !== 'invoiced')
    }
    if (ownerFilter === 'mine' && user) {
      result = result.filter((r) => r.assigned_to === user.id)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.so_number.toLowerCase().includes(q) ||
          r.customers?.name.toLowerCase().includes(q) ||
          r.customer_po?.toLowerCase().includes(q) ||
          r.quote_number?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter((r) => r.derivedStatus === statusFilter)
    }
    return result
  }, [orders, search, statusFilter, ownerFilter, showInvoiced, user])

  const columns: Column<OrderRow>[] = [
    {
      key: 'so_number',
      label: 'SO #',
      render: (r) => <span className="font-semibold">{r.so_number}</span>,
    },
    {
      key: 'quote_number',
      label: 'Quote #',
      render: (r) => <span className="text-slate-500">{r.quote_number || '\u2014'}</span>,
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
      key: 'customer_po',
      label: 'Customer PO',
      render: (r) => r.customer_po || '\u2014',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const cfg = SO_HEADER_STATUS_CONFIG[r.derivedStatus]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.derivedStatus
      },
    },
    {
      key: 'install',
      label: 'Install?',
      nowrap: true,
      align: 'center',
      render: (r) => {
        if (!r.requires_install) return <span className="text-slate-300">{'\u2014'}</span>
        if (r.linked_job) {
          return (
            <button
              type="button"
              title={`${r.linked_job.job_number} (${r.linked_job.status})`}
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/scheduling/jobs/${r.linked_job!.id}`)
              }}
              className="inline-flex items-center justify-center"
            >
              <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </button>
          )
        }
        return (
          <button
            type="button"
            title="Install required — click to book job"
            onClick={(e) => {
              e.stopPropagation()
              const params = new URLSearchParams({
                source_type: 'sales_order',
                source_id: r.id,
                source_ref: r.so_number,
                customer_id: r.customer_id,
                ...(r.contact_id ? { contact_id: r.contact_id } : {}),
                ...(r.delivery_address_line1 ? { addr1: r.delivery_address_line1 } : {}),
                ...(r.delivery_address_line2 ? { addr2: r.delivery_address_line2 } : {}),
                ...(r.delivery_city ? { city: r.delivery_city } : {}),
                ...(r.delivery_postcode ? { postcode: r.delivery_postcode } : {}),
                ...(r.install_notes ? { notes: r.install_notes } : {}),
              })
              router.push(`/scheduling/jobs/new?${params.toString()}`)
            }}
            className="inline-flex items-center justify-center"
          >
            <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
          </button>
        )
      },
    },
    {
      key: 'lines',
      label: 'Lines',
      align: 'center',
      render: (r) => r.sales_order_lines?.length || 0,
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      nowrap: true,
      render: (r) => {
        const subtotal = (r.sales_order_lines || []).reduce(
          (s, l) => s + l.sell_price * l.quantity,
          0
        )
        return <span className="font-semibold">{formatCurrency(subtotal)}</span>
      },
    },
    {
      key: 'delivery',
      label: 'Delivery Date',
      render: (r) =>
        r.requested_delivery_date ? formatDate(r.requested_delivery_date) : '\u2014',
    },
    {
      key: 'created',
      label: 'Created',
      render: (r) => formatDate(r.created_at),
    },
  ]

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="text"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:flex-1 sm:max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value as 'all' | 'mine')}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="all">All Orders</option>
          <option value="mine">My Orders</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Statuses</option>
          {Object.entries(SO_HEADER_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInvoiced}
            onChange={(e) => setShowInvoiced(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show Invoiced
        </label>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/orders/${r.id}`)}
        emptyMessage="No sales orders found."
      />
    </div>
  )
}
