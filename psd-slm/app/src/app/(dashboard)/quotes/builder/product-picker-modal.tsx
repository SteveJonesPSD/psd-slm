'use client'

import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
import { formatCurrency, generateUUID } from '@/lib/utils'
import { createCategory } from '../../products/categories/actions'
import type { ProductLookup, CategoryLookup, ProductSupplierLookup, FormLine } from './quote-builder-types'
import type { ActiveDealPricing } from '@/types/database'

interface ProductPickerModalProps {
  onClose: () => void
  onSelect: (line: FormLine) => void
  products: ProductLookup[]
  categories: CategoryLookup[]
  productSuppliers: ProductSupplierLookup[]
  dealPricing: ActiveDealPricing[]
  customerId: string
  targetGroupId: string
  currentLineCount: number
  onRefresh?: () => void
}

export function ProductPickerModal({
  onClose,
  onSelect,
  products,
  categories,
  productSuppliers,
  dealPricing,
  customerId,
  targetGroupId,
  currentLineCount,
  onRefresh,
}: ProductPickerModalProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [localCategories, setLocalCategories] = useState<CategoryLookup[]>(categories)

  const filtered = useMemo(() => {
    let result = products
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      )
    }
    if (categoryFilter) {
      result = result.filter((p) => p.category_id === categoryFilter)
    }
    return result
  }, [products, search, categoryFilter])

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setCategoryLoading(true)
    const formData = new FormData()
    formData.set('name', newCategoryName.trim())
    formData.set('requires_serial', 'false')
    const result = await createCategory(formData)
    setCategoryLoading(false)
    if (result.data) {
      setLocalCategories((prev) => [...prev, { id: result.data.id, name: result.data.name }])
      setCategoryFilter(result.data.id)
      setNewCategoryName('')
      setShowNewCategory(false)
    }
  }

  const handleRefresh = async () => {
    if (!onRefresh) return
    setRefreshing(true)
    onRefresh()
    // Brief visual feedback
    setTimeout(() => setRefreshing(false), 500)
  }

  const handleSelect = (product: ProductLookup) => {
    // 1. Check deal pricing for this customer + product
    const dealReg = dealPricing.find(
      (dp) => dp.customer_id === customerId && dp.product_id === product.id
    )

    let buy_price = product.default_buy_price || 0
    let sell_price = product.default_sell_price || 0
    let supplier_id: string | null = null
    let deal_reg_line_id: string | null = null
    let original_deal_price: number | null = null

    if (dealReg) {
      // Deal reg pricing takes priority
      buy_price = dealReg.deal_cost
      supplier_id = dealReg.supplier_id
      deal_reg_line_id = dealReg.deal_reg_line_id
      original_deal_price = dealReg.deal_cost
    } else {
      // Check for preferred product_supplier
      const preferred = productSuppliers.find(
        (ps) => ps.product_id === product.id && ps.is_preferred
      )
      if (preferred) {
        supplier_id = preferred.supplier_id
        if (preferred.standard_cost != null) {
          buy_price = preferred.standard_cost
        }
      }
    }

    const line: FormLine = {
      tempId: generateUUID(),
      tempGroupId: targetGroupId,
      product_id: product.id,
      supplier_id,
      deal_reg_line_id,
      sort_order: currentLineCount,
      description: product.name,
      quantity: 1,
      buy_price,
      sell_price,
      fulfilment_route: 'from_stock',
      is_optional: false,
      requires_contract: false,
      notes: null,
      original_deal_price,
    }

    onSelect(line)
    onClose()
  }

  return (
    <Modal title="Add Product" onClose={onClose} width={700}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU..."
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 min-w-[200px]"
          autoFocus
        />
        <SearchableSelect
          value={categoryFilter}
          options={localCategories.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="All Categories"
          onChange={setCategoryFilter}
          className="w-48"
        />
        <button
          type="button"
          onClick={() => setShowNewCategory(!showNewCategory)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
          title="Create new category"
        >
          + Category
        </button>
        {onRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh product list"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* Inline new category form */}
      {showNewCategory && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name..."
            className="flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-400"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
          />
          <Button size="sm" variant="primary" onClick={handleCreateCategory} disabled={categoryLoading || !newCategoryName.trim()}>
            {categoryLoading ? 'Creating...' : 'Create'}
          </Button>
          <button type="button" onClick={() => setShowNewCategory(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
      )}

      <div className="max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No products found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Product</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">SKU</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buy</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sell</th>
                <th className="px-5 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const hasDealReg = dealPricing.some(
                  (dp) => dp.customer_id === customerId && dp.product_id === product.id
                )
                const dealPrice = dealPricing.find(
                  (dp) => dp.customer_id === customerId && dp.product_id === product.id
                )

                return (
                  <tr
                    key={product.id}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleSelect(product)}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{product.name}</span>
                        {hasDealReg && (
                          <Badge label="DR" color="#7c3aed" bg="#f5f3ff" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">{product.sku}</td>
                    <td className="px-5 py-2.5 text-slate-500">{product.category_name || '\u2014'}</td>
                    <td className="px-5 py-2.5 text-right">
                      {hasDealReg && dealPrice ? (
                        <span className="text-purple-600 font-medium">
                          {formatCurrency(dealPrice.deal_cost)}
                        </span>
                      ) : (
                        product.default_buy_price != null ? formatCurrency(product.default_buy_price) : '\u2014'
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {product.default_sell_price != null ? formatCurrency(product.default_sell_price) : '\u2014'}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelect(product)
                        }}
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}
