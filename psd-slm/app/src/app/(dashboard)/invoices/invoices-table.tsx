'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, INVOICE_STATUS_CONFIG, INVOICE_TYPE_CONFIG } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'

interface InvoiceRow {
  id: string
  invoice_number: string
  status: string
  effectiveStatus: string
  invoice_type: string
  customer_id: string
  total: number
  subtotal: number
  vat_amount: number
  due_date: string | null
  paid_at: string | null
  created_at: string
  customers: { id: string; name: string } | null
  brands: { id: string; name: string; invoice_prefix: string } | null
  sales_orders: { id: string; so_number: string } | null
}

interface InvoicesTableProps {
  invoices: InvoiceRow[]
}

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const filtered = useMemo(() => {
    let result = invoices
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.invoice_number.toLowerCase().includes(q) ||
          r.customers?.name.toLowerCase().includes(q) ||
          r.sales_orders?.so_number.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter((r) => r.effectiveStatus === statusFilter)
    }
    if (typeFilter) {
      result = result.filter((r) => r.invoice_type === typeFilter)
    }
    return result
  }, [invoices, search, statusFilter, typeFilter])

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      nowrap: true,
      render: (r) => <span className="font-semibold">{r.invoice_number}</span>,
    },
    {
      key: 'brand',
      label: 'Brand',
      nowrap: true,
      render: (r) => r.brands?.name || '\u2014',
    },
    {
      key: 'customer',
      label: 'Company',
      render: (r) => r.customers?.name || '',
    },
    {
      key: 'so_number',
      label: 'SO #',
      nowrap: true,
      render: (r) => (
        <span className="text-blue-600">{r.sales_orders?.so_number || '\u2014'}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      nowrap: true,
      render: (r) => {
        if (r.invoice_type === 'standard') return null
        const cfg = INVOICE_TYPE_CONFIG[r.invoice_type]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.invoice_type
      },
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r) => {
        const cfg = INVOICE_STATUS_CONFIG[r.effectiveStatus]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.effectiveStatus
      },
    },
    {
      key: 'date',
      label: 'Date',
      nowrap: true,
      render: (r) => formatDate(r.created_at),
    },
    {
      key: 'due_date',
      label: 'Due',
      nowrap: true,
      render: (r) => {
        if (!r.due_date) return '\u2014'
        const isOverdue = r.effectiveStatus === 'overdue'
        return (
          <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
            {formatDate(r.due_date)}
          </span>
        )
      },
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      nowrap: true,
      render: (r) => (
        <span className={`font-semibold ${r.total < 0 ? 'text-red-600' : ''}`}>
          {formatCurrency(r.total)}
        </span>
      ),
    },
    {
      key: 'paid',
      label: 'Paid',
      align: 'center',
      nowrap: true,
      render: (r) =>
        r.paid_at ? (
          <span className="text-green-600" title={formatDate(r.paid_at)}>&#10003;</span>
        ) : (
          <span className="text-slate-300">\u2014</span>
        ),
    },
  ]

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="text"
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Statuses</option>
          {Object.entries(INVOICE_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Types</option>
          {Object.entries(INVOICE_TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/invoices/${r.id}`)}
        emptyMessage="No invoices found."
      />
    </div>
  )
}
