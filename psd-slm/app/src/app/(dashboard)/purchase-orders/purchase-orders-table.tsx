'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, PO_STATUS_CONFIG, DELIVERY_DESTINATION_CONFIG, PURCHASE_TYPE_CONFIG } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PoLine {
  id: string
  quantity: number
  unit_cost: number
  status: string
}

interface PoRow {
  id: string
  po_number: string
  status: string
  purchase_type?: string
  delivery_destination: string
  delivery_cost: number
  expected_delivery_date: string | null
  created_at: string
  suppliers: { id: string; name: string } | null
  sales_orders: {
    id: string
    so_number: string
    customer_id: string
    customers: { id: string; name: string } | null
  } | null
  purchase_order_lines: PoLine[]
  creator: { id: string; first_name: string; last_name: string } | null
}

interface PurchaseOrdersTableProps {
  orders: PoRow[]
}

export function PurchaseOrdersTable({ orders }: PurchaseOrdersTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const filtered = useMemo(() => {
    let result = orders
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.po_number.toLowerCase().includes(q) ||
          r.suppliers?.name.toLowerCase().includes(q) ||
          r.sales_orders?.so_number?.toLowerCase().includes(q) ||
          r.sales_orders?.customers?.name.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter)
    }
    if (typeFilter) {
      result = result.filter((r) => (r.purchase_type || 'customer_order') === typeFilter)
    }
    return result
  }, [orders, search, statusFilter, typeFilter])

  const columns: Column<PoRow>[] = [
    {
      key: 'po_number',
      label: 'PO #',
      nowrap: true,
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{r.po_number}</span>
          {r.purchase_type === 'stock_order' && (
            <Badge label={PURCHASE_TYPE_CONFIG.stock_order?.label || 'Stock'} color={PURCHASE_TYPE_CONFIG.stock_order?.color || '#2563eb'} bg={PURCHASE_TYPE_CONFIG.stock_order?.bg || '#eff6ff'} />
          )}
        </span>
      ),
    },
    {
      key: 'so_number',
      label: 'SO #',
      nowrap: true,
      render: (r) =>
        r.sales_orders ? (
          <span className="text-slate-500">{r.sales_orders.so_number}</span>
        ) : (
          <span className="text-slate-300">{'\u2014'}</span>
        ),
    },
    {
      key: 'supplier',
      label: 'Supplier',
      render: (r) => r.suppliers?.name || '',
    },
    {
      key: 'customer',
      label: 'Company',
      render: (r) => r.sales_orders?.customers?.name || (r.purchase_type === 'stock_order' ? <span className="text-slate-300">{'\u2014'}</span> : ''),
    },
    {
      key: 'delivery_to',
      label: 'Delivery To',
      nowrap: true,
      render: (r) => {
        const cfg = DELIVERY_DESTINATION_CONFIG[r.delivery_destination]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.delivery_destination
      },
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r) => {
        const cfg = PO_STATUS_CONFIG[r.status]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.status
      },
    },
    {
      key: 'lines',
      label: 'Lines',
      align: 'center',
      nowrap: true,
      render: (r) => r.purchase_order_lines?.length || 0,
    },
    {
      key: 'goods_total',
      label: 'Goods',
      align: 'right',
      nowrap: true,
      render: (r) => {
        const total = (r.purchase_order_lines || []).reduce(
          (s, l) => s + l.quantity * l.unit_cost,
          0
        )
        return formatCurrency(total)
      },
    },
    {
      key: 'delivery_cost',
      label: 'Delivery',
      align: 'right',
      nowrap: true,
      render: (r) => r.delivery_cost > 0 ? formatCurrency(r.delivery_cost) : '\u2014',
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      nowrap: true,
      render: (r) => {
        const goods = (r.purchase_order_lines || []).reduce(
          (s, l) => s + l.quantity * l.unit_cost,
          0
        )
        return <span className="font-semibold">{formatCurrency(goods + (r.delivery_cost || 0))}</span>
      },
    },
    {
      key: 'expected',
      label: 'Expected',
      nowrap: true,
      render: (r) => r.expected_delivery_date ? formatDate(r.expected_delivery_date) : '\u2014',
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
          placeholder="Search purchase orders..."
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
          {Object.entries(PO_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Types</option>
          <option value="customer_order">Customer Order</option>
          <option value="stock_order">Stock Order</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/purchase-orders/${r.id}`)}
        emptyMessage="No purchase orders found."
      />
    </div>
  )
}
