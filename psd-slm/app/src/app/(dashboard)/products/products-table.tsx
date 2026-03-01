'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { MarginIndicator } from '@/components/ui/margin-indicator'
import { SerialisedBadge } from '@/components/ui/serialised-badge'
import { formatCurrency } from '@/lib/utils'
import { seedProducts } from './actions'
import type { Product, ProductCategory } from '@/types/database'

type ProductWithExtras = Product & {
  category_name: string | null
  category_requires_serial: boolean
  supplier_count: number
  main_supplier_name: string | null
}

interface ProductsTableProps {
  products: ProductWithExtras[]
  categories: ProductCategory[]
}

export function ProductsTable({ products, categories }: ProductsTableProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('products', 'create')

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showStocked, setShowStocked] = useState(false)
  const [showActive, setShowActive] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const filtered = products.filter((p) => {
    const s = search.toLowerCase()
    const matchesSearch =
      p.name.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s) ||
      (p.manufacturer || '').toLowerCase().includes(s)
    const matchesCat = !catFilter || p.category_id === catFilter
    const matchesStocked = !showStocked || p.is_stocked
    const matchesActive = !showActive || p.is_active
    return matchesSearch && matchesCat && matchesStocked && matchesActive
  })

  const hasFilters = search || catFilter || showStocked || !showActive

  const handleSeed = async () => {
    setSeeding(true)
    await seedProducts()
    setSeeding(false)
    router.refresh()
  }

  const columns: Column<ProductWithExtras>[] = [
    {
      key: 'sku',
      label: 'SKU',
      nowrap: true,
      render: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    {
      key: 'name',
      label: 'Product',
      render: (r) => <span className="font-semibold">{r.name}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      render: (r) => r.category_name || '\u2014',
    },
    {
      key: 'manufacturer',
      label: 'Manufacturer',
      render: (r) => r.manufacturer || '\u2014',
    },
    {
      key: 'main_supplier',
      label: 'Main Supplier',
      render: (r) => r.main_supplier_name || '\u2014',
    },
    {
      key: 'buy',
      label: 'Default Buy',
      align: 'right',
      nowrap: true,
      render: (r) =>
        r.default_buy_price != null ? formatCurrency(r.default_buy_price) : '\u2014',
    },
    {
      key: 'sell',
      label: 'Default Sell',
      align: 'right',
      nowrap: true,
      render: (r) =>
        r.default_sell_price != null ? formatCurrency(r.default_sell_price) : '\u2014',
    },
    {
      key: 'margin',
      label: 'Margin %',
      align: 'right',
      nowrap: true,
      render: (r) => (
        <MarginIndicator buyPrice={r.default_buy_price} sellPrice={r.default_sell_price} />
      ),
    },
    {
      key: 'serialised',
      label: 'Serialised',
      align: 'center',
      render: (r) => (
        <SerialisedBadge
          productIsSerialised={r.is_serialised}
          categoryRequiresSerial={r.category_requires_serial}
        />
      ),
    },
    {
      key: 'stocked',
      label: 'Stocked',
      align: 'center',
      render: (r) =>
        r.is_stocked ? <Badge label="Stocked" color="#059669" bg="#ecfdf5" /> : null,
    },
    {
      key: 'suppliers',
      label: 'Suppliers',
      align: 'center',
      render: (r) => r.supplier_count || '\u2014',
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search name, SKU, manufacturer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showStocked}
            onChange={(e) => setShowStocked(e.target.checked)}
            className="rounded border-slate-300"
          />
          Stocked
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showActive}
            onChange={(e) => setShowActive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Active only
        </label>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setCatFilter(''); setShowStocked(false); setShowActive(true) }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Clear filters
          </button>
        )}
        <div className="flex-1" />
        {canCreate && (
          <Button variant="primary" onClick={() => router.push('/products/new')}>
            + New Product
          </Button>
        )}
      </div>

      {filtered.length === 0 && products.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400 mb-4">No products in catalogue yet.</p>
          {canCreate && (
            <Button variant="primary" onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Seeding...' : 'Seed Default Products'}
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(r) => router.push(`/products/${r.id}`)}
          emptyMessage="No products match your filters."
        />
      )}
    </div>
  )
}
