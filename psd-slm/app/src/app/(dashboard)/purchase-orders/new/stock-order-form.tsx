'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
import { formatCurrency } from '@/lib/utils'
import { createStockOrder } from '../actions'

interface ProductOption {
  id: string
  name: string
  sku: string
  default_buy_price: number
  product_type: string
  product_suppliers: { supplier_id: string; standard_cost: number; supplier_sku: string | null }[]
}

interface SupplierOption {
  id: string
  name: string
}

interface StockOrderLine {
  key: number
  productId: string
  description: string
  quantity: number
  unitCost: number
}

interface StockOrderFormProps {
  suppliers: SupplierOption[]
  products: ProductOption[]
}

export function StockOrderForm({ suppliers, products }: StockOrderFormProps) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<StockOrderLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextKey, setNextKey] = useState(1)

  // Filter products to those available from the selected supplier (or show all if no supplier filtering needed)
  const supplierProducts = useMemo(() => {
    if (!supplierId) return products
    return products.filter(p =>
      p.product_suppliers.some(ps => ps.supplier_id === supplierId) || p.product_suppliers.length === 0
    )
  }, [products, supplierId])

  const addLine = () => {
    setLines(prev => [...prev, {
      key: nextKey,
      productId: '',
      description: '',
      quantity: 1,
      unitCost: 0,
    }])
    setNextKey(n => n + 1)
  }

  const updateLine = (key: number, field: keyof StockOrderLine, value: string | number) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))
  }

  const removeLine = (key: number) => {
    setLines(prev => prev.filter(l => l.key !== key))
  }

  const selectProduct = (key: number, productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    // Get supplier-specific cost if available
    const supplierLink = supplierId
      ? product.product_suppliers.find(ps => ps.supplier_id === supplierId)
      : null
    const cost = supplierLink?.standard_cost ?? product.default_buy_price ?? 0

    setLines(prev => prev.map(l => l.key === key ? {
      ...l,
      productId,
      description: product.name,
      unitCost: cost,
    } : l))
  }

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0)

  const handleSubmit = async () => {
    setError(null)

    if (!supplierId) {
      setError('Please select a supplier.')
      return
    }
    if (lines.length === 0) {
      setError('Please add at least one line.')
      return
    }
    const invalidLines = lines.filter(l => !l.productId || l.quantity <= 0)
    if (invalidLines.length > 0) {
      setError('All lines must have a product selected and quantity > 0.')
      return
    }

    setSaving(true)
    try {
      const result = await createStockOrder({
        supplierId,
        expectedDeliveryDate: expectedDate || null,
        deliveryInstructions: deliveryInstructions || null,
        notes: notes || null,
        lines: lines.map(l => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      })

      if ('error' in result && result.error) {
        setError(result.error)
      } else if ('poId' in result) {
        router.push(`/purchase-orders/${result.poId}`)
      }
    } catch (e) {
      console.error('[stock-order-form]', e)
      setError(e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }))
  const productOptions = supplierProducts.map(p => ({
    value: p.id,
    label: `${p.name} (${p.sku})`,
  }))

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-[15px] font-semibold mb-4">Order Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Supplier <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={supplierOptions}
              value={supplierId}
              onChange={(v) => setSupplierId(v)}
              placeholder="Select supplier..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Delivery Instructions
            </label>
            <textarea
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. Deliver to PSD warehouse, Unit 3..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h3 className="text-[15px] font-semibold">Order Lines</h3>
          <Button size="sm" variant="default" onClick={addLine}>
            + Add Line
          </Button>
        </div>

        {lines.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            No lines added yet. Click &quot;+ Add Line&quot; to start.
          </div>
        ) : (
          <div className="overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium uppercase text-slate-400 border-b border-gray-100">
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-right w-24">Qty</th>
                  <th className="px-5 py-3 text-right w-32">Unit Cost</th>
                  <th className="px-5 py-3 text-right w-32">Line Total</th>
                  <th className="px-5 py-3 text-right w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.map(line => (
                  <tr key={line.key}>
                    <td className="px-5 py-2.5">
                      <SearchableSelect
                        options={productOptions}
                        value={line.productId}
                        onChange={(v) => selectProduct(line.key, v)}
                        placeholder="Search products..."
                      />
                    </td>
                    <td className="px-5 py-2.5">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-right outline-none focus:border-slate-400"
                      />
                    </td>
                    <td className="px-5 py-2.5">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.key, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-right outline-none focus:border-slate-400"
                      />
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap">
                      {formatCurrency(line.quantity * line.unitCost)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => removeLine(line.key)}
                        className="text-red-400 hover:text-red-600 text-xs"
                        title="Remove line"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {lines.length > 0 && (
          <div className="border-t border-gray-200 px-5 py-3">
            <div className="flex justify-end gap-4 text-sm">
              <span className="font-semibold text-slate-700">Order Total:</span>
              <span className="font-bold w-32 text-right">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="default" onClick={() => router.push('/purchase-orders')}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Creating...' : 'Create Stock Order'}
        </Button>
      </div>
    </div>
  )
}
