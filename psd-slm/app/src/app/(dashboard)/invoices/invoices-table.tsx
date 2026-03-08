'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, INVOICE_STATUS_CONFIG, INVOICE_TYPE_CONFIG } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { XeroStatusPill } from '@/components/invoices/xero-status-pill'
import { XeroPushToolbar } from '@/components/invoices/xero-push-toolbar'

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
  xero_status: string | null
  xero_pushed_at: string | null
  xero_invoice_id: string | null
  xero_error: string | null
  customers: { id: string; name: string } | null
  brands: { id: string; name: string; invoice_prefix: string } | null
  sales_orders: { id: string; so_number: string } | null
}

interface InvoicesTableProps {
  invoices: InvoiceRow[]
  xeroEnabled?: boolean
  canPushXero?: boolean
}

export function InvoicesTable({ invoices, xeroEnabled = false, canPushXero = false }: InvoicesTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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

  // Pushable invoices: sent status, non-proforma, not currently pending
  const pushableFiltered = filtered.filter(
    (r) => r.effectiveStatus === 'sent' && r.invoice_type !== 'proforma' && r.xero_status !== 'pending'
  )

  const allPushableSelected = pushableFiltered.length > 0 && pushableFiltered.every((r) => selectedIds.includes(r.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (allPushableSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(pushableFiltered.map((r) => r.id))
    }
  }

  const showCheckboxes = xeroEnabled && canPushXero

  const columns: Column<InvoiceRow>[] = [
    // Xero checkbox column (conditional)
    ...(showCheckboxes ? [{
      key: 'xero_select' as const,
      label: (
        <input
          type="checkbox"
          checked={allPushableSelected}
          onChange={toggleSelectAll}
          className="rounded border-slate-300"
          title="Select all pushable invoices"
        />
      ) as unknown as string,
      nowrap: true,
      render: (r: InvoiceRow) => {
        const canSelect = r.effectiveStatus === 'sent' && r.invoice_type !== 'proforma' && r.xero_status !== 'pending'
        if (!canSelect) return null
        return (
          <input
            type="checkbox"
            checked={selectedIds.includes(r.id)}
            onChange={(e) => { e.stopPropagation(); toggleSelect(r.id) }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-slate-300"
          />
        )
      },
    }] : []),
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
    // Xero status column (conditional)
    ...(xeroEnabled ? [{
      key: 'xero' as const,
      label: 'Xero',
      nowrap: true,
      render: (r: InvoiceRow) => (
        <XeroStatusPill
          xeroStatus={r.xero_status}
          xeroPushedAt={r.xero_pushed_at}
          xeroInvoiceId={r.xero_invoice_id}
          xeroError={r.xero_error}
        />
      ),
    }] : []),
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
          className="w-full sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500 dark:text-slate-200"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500 dark:text-slate-200"
        >
          <option value="">All Statuses</option>
          {Object.entries(INVOICE_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex-1 sm:flex-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500 dark:text-slate-200"
        >
          <option value="">All Types</option>
          {Object.entries(INVOICE_TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Xero Push Toolbar */}
      {showCheckboxes && (
        <XeroPushToolbar
          selectedIds={selectedIds}
          onComplete={() => {
            setSelectedIds([])
            router.refresh()
          }}
          onClear={() => setSelectedIds([])}
        />
      )}

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/invoices/${r.id}`)}
        emptyMessage="No invoices found."
      />
    </div>
  )
}
