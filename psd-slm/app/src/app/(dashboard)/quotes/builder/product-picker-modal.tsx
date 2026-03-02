'use client'

import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
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
}: ProductPickerModalProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

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
      tempId: crypto.randomUUID(),
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
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU..."
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          autoFocus
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No products found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Product</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">SKU</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buy</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sell</th>
                <th className="px-3 py-2 w-16" />
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
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{product.name}</span>
                        {hasDealReg && (
                          <Badge label="DR" color="#7c3aed" bg="#f5f3ff" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{product.sku}</td>
                    <td className="px-3 py-2 text-slate-500">{product.category_name || '\u2014'}</td>
                    <td className="px-3 py-2 text-right">
                      {hasDealReg && dealPrice ? (
                        <span className="text-purple-600 font-medium">
                          {formatCurrency(dealPrice.deal_cost)}
                        </span>
                      ) : (
                        product.default_buy_price != null ? formatCurrency(product.default_buy_price) : '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {product.default_sell_price != null ? formatCurrency(product.default_sell_price) : '\u2014'}
                    </td>
                    <td className="px-3 py-2 text-right">
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
