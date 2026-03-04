'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { MarginIndicator } from '@/components/ui/margin-indicator'
import { SerialisedBadge } from '@/components/ui/serialised-badge'
import { formatCurrency } from '@/lib/utils'
import { seedProducts } from './actions'
import { AiCreateModal } from './ai-create-modal'
import { FindSerialModal } from './find-serial-modal'
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
  const [typeFilter, setTypeFilter] = useState('')
  const [showStocked, setShowStocked] = useState(false)
  const [showActive, setShowActive] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [aiModalMode, setAiModalMode] = useState<'url' | 'paste' | 'screenshot' | null>(null)
  const [showAiDropdown, setShowAiDropdown] = useState(false)
  const [showFindSerial, setShowFindSerial] = useState(false)
  const aiDropdownRef = useRef<HTMLDivElement>(null)

  const filtered = products.filter((p) => {
    const s = search.toLowerCase()
    const matchesSearch =
      p.name.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s) ||
      (p.manufacturer || '').toLowerCase().includes(s)
    const matchesCat = !catFilter || p.category_id === catFilter
    const matchesType = !typeFilter || p.product_type === typeFilter
    const matchesStocked = !showStocked || p.is_stocked
    const matchesActive = !showActive || p.is_active
    return matchesSearch && matchesCat && matchesType && matchesStocked && matchesActive
  })

  const hasFilters = search || catFilter || typeFilter || showStocked || !showActive

  const handleSeed = async () => {
    setSeeding(true)
    await seedProducts()
    setSeeding(false)
    router.refresh()
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) {
        setShowAiDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      render: (r) => (
        <span className="font-semibold">
          {r.name}
          {r.product_type === 'service' && (
            <span className="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-50 text-violet-600 align-middle">
              SVC
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (r) => r.category_name || '\u2014',
    },
    {
      key: 'manufacturer',
      label: 'Manufacturer',
      render: (r) => r.product_type === 'service' ? '\u2014' : (r.manufacturer || '\u2014'),
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
      nowrap: true,
      render: (r) => r.product_type === 'service' ? <span className="text-slate-300">\u2014</span> : (
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
      nowrap: true,
      render: (r) =>
        r.product_type === 'service' ? <span className="text-slate-300">\u2014</span> :
        r.is_stocked ? <Badge label="Stocked" color="#059669" bg="#ecfdf5" /> : null,
    },
    {
      key: 'suppliers',
      label: 'Suppliers',
      align: 'center',
      nowrap: true,
      render: (r) => r.supplier_count || '\u2014',
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
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
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="">All Types</option>
          <option value="goods">Goods</option>
          <option value="service">Services</option>
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
            onClick={() => { setSearch(''); setCatFilter(''); setTypeFilter(''); setShowStocked(false); setShowActive(true) }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Clear filters
          </button>
        )}
        <Button variant="default" onClick={() => setShowFindSerial(true)}>
          Find Serial
        </Button>
        <div className="flex-1" />
        {canCreate && (
          <>
            <div ref={aiDropdownRef} className="relative flex">
              <button
                type="button"
                onClick={() => setAiModalMode('screenshot')}
                className="inline-flex items-center rounded-l-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Create with AI
              </button>
              <button
                type="button"
                onClick={() => setShowAiDropdown((v) => !v)}
                className="inline-flex items-center rounded-r-lg border border-l-0 border-slate-200 bg-white px-1.5 py-2 text-slate-500 hover:bg-slate-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAiDropdown && (
                <div className="absolute right-0 z-20 mt-1 top-full w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => { setShowAiDropdown(false); setAiModalMode('screenshot') }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="block text-sm font-medium text-slate-700">From Screenshot</span>
                    <span className="block text-xs text-slate-400">Upload or paste an image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAiDropdown(false); setAiModalMode('url') }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="block text-sm font-medium text-slate-700">From URL</span>
                    <span className="block text-xs text-slate-400">Fetch a product page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAiDropdown(false); setAiModalMode('paste') }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="block text-sm font-medium text-slate-700">From Web Page</span>
                    <span className="block text-xs text-slate-400">Paste page content</span>
                  </button>
                </div>
              )}
            </div>
            <Button variant="primary" onClick={() => router.push('/products/new')}>
              + New Product
            </Button>
          </>
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
      {aiModalMode && <AiCreateModal initialMode={aiModalMode} onClose={() => setAiModalMode(null)} />}
      {showFindSerial && <FindSerialModal onClose={() => setShowFindSerial(false)} />}
    </div>
  )
}
