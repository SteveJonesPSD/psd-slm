'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, STOCK_MOVEMENT_TYPE_CONFIG } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface MovementRow {
  id: string
  movement_type: string
  quantity: number
  reference_type: string | null
  reference_id: string | null
  serial_numbers: string[] | null
  reason: string | null
  notes: string | null
  created_at: string
  products: { id: string; name: string; sku: string } | null
  stock_locations: { id: string; name: string; code: string } | null
  creator: { id: string; first_name: string; last_name: string } | null
}

interface MovementsTableProps {
  movements: MovementRow[]
  preFilterProductId?: string
}

export function MovementsTable({ movements, preFilterProductId }: MovementsTableProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const filtered = useMemo(() => {
    let result = movements
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        m => m.products?.name.toLowerCase().includes(q) ||
          m.products?.sku.toLowerCase().includes(q) ||
          m.reason?.toLowerCase().includes(q) ||
          m.notes?.toLowerCase().includes(q)
      )
    }
    if (typeFilter) {
      result = result.filter(m => m.movement_type === typeFilter)
    }
    return result
  }, [movements, search, typeFilter])

  function getReferenceLink(refType: string | null, refId: string | null) {
    if (!refType || !refId) return null
    if (refType === 'purchase_order_line') return `/purchase-orders`
    if (refType === 'stock_allocation') return null
    if (refType === 'stock_take') return `/stock/takes/${refId}`
    return null
  }

  const columns: Column<MovementRow>[] = [
    {
      key: 'date',
      label: 'Date/Time',
      nowrap: true,
      render: (r) => formatDate(r.created_at),
    },
    {
      key: 'product',
      label: 'Product',
      render: (r) => (
        <div>
          <div className="font-medium">{r.products?.name}</div>
          <div className="text-xs text-slate-400 font-mono">{r.products?.sku}</div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      nowrap: true,
      render: (r) => {
        const cfg = STOCK_MOVEMENT_TYPE_CONFIG[r.movement_type]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.movement_type
      },
    },
    {
      key: 'quantity',
      label: 'Qty',
      align: 'right',
      nowrap: true,
      render: (r) => {
        const color = r.quantity > 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'
        return <span className={color}>{r.quantity > 0 ? `+${r.quantity}` : r.quantity}</span>
      },
    },
    {
      key: 'reference',
      label: 'Reference',
      nowrap: true,
      render: (r) => {
        const link = getReferenceLink(r.reference_type, r.reference_id)
        if (link) {
          return (
            <Link href={link} className="text-blue-600 hover:underline no-underline text-xs" onClick={e => e.stopPropagation()}>
              {r.reference_type}
            </Link>
          )
        }
        return r.reference_type ? <span className="text-xs text-slate-400">{r.reference_type}</span> : '\u2014'
      },
    },
    {
      key: 'serials',
      label: 'Serial Numbers',
      render: (r) => {
        const serials = r.serial_numbers as string[] | null
        if (!serials || serials.length === 0) return null
        return (
          <span className="text-xs text-slate-500 font-mono">
            {serials.length <= 3 ? serials.join(', ') : `${serials.slice(0, 3).join(', ')} +${serials.length - 3}`}
          </span>
        )
      },
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r) => r.reason || r.notes || '\u2014',
    },
    {
      key: 'user',
      label: 'User',
      nowrap: true,
      render: (r) => r.creator ? `${r.creator.first_name} ${r.creator.last_name}` : '\u2014',
    },
  ]

  return (
    <div>
      {preFilterProductId && (
        <div className="mb-6 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
          Showing movements for a specific product.{' '}
          <Link href="/stock/movements" className="underline">Show all</Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="text"
          placeholder="Search movements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Types</option>
          {Object.entries(STOCK_MOVEMENT_TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No stock movements found."
      />
    </div>
  )
}
