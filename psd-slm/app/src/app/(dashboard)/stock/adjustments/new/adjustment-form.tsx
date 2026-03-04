'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { adjustStock } from '@/app/(dashboard)/stock/actions'
import { createClient } from '@/lib/supabase/client'
import { SearchableSelect } from '@/components/ui/form-fields'
import { ADJUSTMENT_REASONS } from '@/lib/stock'
import type { StockLocation } from '@/types/database'

interface AdjustmentFormProps {
  locations: StockLocation[]
}

interface ProductOption {
  id: string
  sku: string
  name: string
  is_serialised: boolean | null
  is_stocked: boolean
}

export function AdjustmentForm({ locations }: AdjustmentFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [locationId, setLocationId] = useState(locations.find(l => l.is_default)?.id || locations[0]?.id || '')
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0])
  const [notes, setNotes] = useState('')
  const [serialNumbers, setSerialNumbers] = useState('')

  const handleProductSearch = async (query: string) => {
    setProductSearch(query)
    if (query.length < 2) {
      setProducts([])
      return
    }
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('id, sku, name, is_serialised, is_stocked')
      .eq('is_stocked', true)
      .eq('is_active', true)
      .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(10)

    setProducts(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct || !locationId) return

    setLoading(true)
    setError(null)

    const serials = serialNumbers
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    const result = await adjustStock({
      productId: selectedProduct.id,
      locationId,
      adjustmentType,
      quantity,
      reason,
      notes: notes || undefined,
      serialNumbers: serials.length > 0 ? serials : undefined,
    })

    if ('error' in result) {
      setError(result.error as string)
      setLoading(false)
    } else {
      router.push('/stock')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        {/* Product picker */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
          {selectedProduct ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <div className="flex-1">
                <div className="font-medium text-sm">{selectedProduct.name}</div>
                <div className="text-xs text-slate-400 font-mono">{selectedProduct.sku}</div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedProduct(null); setProductSearch('') }}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Search by SKU or name..."
                value={productSearch}
                onChange={(e) => handleProductSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                autoFocus
              />
              {products.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                  {products.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedProduct(p); setProducts([]) }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <span className="font-mono text-xs text-slate-400">{p.sku}</span>
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Location */}
        <SearchableSelect
          label="Location"
          value={locationId}
          options={locations.map(loc => ({ value: loc.id, label: `${loc.name} (${loc.code})${loc.is_default ? ' — Default' : ''}` }))}
          placeholder="Search locations..."
          onChange={setLocationId}
        />

        {/* Adjustment type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAdjustmentType('increase')}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                adjustmentType === 'increase'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              Increase (+)
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentType('decrease')}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                adjustmentType === 'decrease'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              Decrease (-)
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            {ADJUSTMENT_REASONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="Optional notes..."
          />
        </div>

        {/* Serial numbers (if serialised) */}
        {selectedProduct?.is_serialised && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Serial Numbers (one per line)
            </label>
            <textarea
              value={serialNumbers}
              onChange={(e) => setSerialNumbers(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-slate-400"
              placeholder="Enter serial numbers, one per line..."
            />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
      </div>

      <div className="flex items-center gap-3 justify-end">
        <Link
          href="/stock"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading || !selectedProduct}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Submit Adjustment'}
        </button>
      </div>
    </form>
  )
}
