'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { StockAvailability } from '@/types/database'

interface StockTableProps {
  stockLevels: StockAvailability[]
}

export function StockTable({ stockLevels }: StockTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showFilter, setShowFilter] = useState('')

  const categories = useMemo(() => {
    const cats = [...new Set(stockLevels.map(s => s.category_name).filter(Boolean))]
    return cats.sort()
  }, [stockLevels])

  const filtered = useMemo(() => {
    let result = stockLevels
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        s => s.sku.toLowerCase().includes(q) ||
          s.product_name.toLowerCase().includes(q) ||
          s.location_name.toLowerCase().includes(q)
      )
    }
    if (categoryFilter) {
      result = result.filter(s => s.category_name === categoryFilter)
    }
    if (showFilter === 'in-stock') {
      result = result.filter(s => s.quantity_on_hand > 0)
    } else if (showFilter === 'below-reorder') {
      result = result.filter(s => s.below_reorder)
    } else if (showFilter === 'zero-stock') {
      result = result.filter(s => s.quantity_on_hand === 0)
    }
    return result
  }, [stockLevels, search, categoryFilter, showFilter])

  const columns: Column<StockAvailability>[] = [
    {
      key: 'sku',
      label: 'SKU',
      nowrap: true,
      render: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    {
      key: 'product',
      label: 'Product',
      render: (r) => r.product_name,
    },
    {
      key: 'category',
      label: 'Category',
      nowrap: true,
      render: (r) => r.category_name || '\u2014',
    },
    {
      key: 'location',
      label: 'Location',
      nowrap: true,
      render: (r) => r.location_name,
    },
    {
      key: 'on_hand',
      label: 'On Hand',
      align: 'right',
      nowrap: true,
      render: (r) => r.quantity_on_hand,
    },
    {
      key: 'allocated',
      label: 'Allocated',
      align: 'right',
      nowrap: true,
      render: (r) => r.quantity_allocated > 0 ? (
        <span className="text-amber-600">{r.quantity_allocated}</span>
      ) : 0,
    },
    {
      key: 'available',
      label: 'Available',
      align: 'right',
      nowrap: true,
      render: (r) => {
        const color = r.quantity_available <= 0
          ? 'text-red-600 font-semibold'
          : r.below_reorder
            ? 'text-amber-600 font-semibold'
            : 'text-emerald-600 font-semibold'
        return <span className={color}>{r.quantity_available}</span>
      },
    },
    {
      key: 'reorder',
      label: 'Reorder Pt',
      align: 'right',
      nowrap: true,
      render: (r) => r.reorder_point > 0 ? r.reorder_point : '\u2014',
    },
    {
      key: 'value',
      label: 'Stock Value',
      align: 'right',
      nowrap: true,
      render: (r) => formatCurrency(r.quantity_on_hand * (r.default_buy_price || 0)),
    },
    {
      key: 'serialised',
      label: 'Serial',
      align: 'center',
      nowrap: true,
      render: (r) => r.is_serialised ? (
        <Badge label="Serialised" color="#7c3aed" bg="#f5f3ff" />
      ) : null,
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search stock..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat!}>{cat}</option>
          ))}
        </select>
        <select
          value={showFilter}
          onChange={(e) => setShowFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All</option>
          <option value="in-stock">In Stock</option>
          <option value="below-reorder">Below Reorder</option>
          <option value="zero-stock">Zero Stock</option>
        </select>
        <div className="flex-1" />
        <Link
          href="/stock/adjustments/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-indigo-700"
        >
          + Stock Adjustment
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/stock/movements?product_id=${r.product_id}`)}
        emptyMessage="No stock levels found."
      />
    </div>
  )
}
