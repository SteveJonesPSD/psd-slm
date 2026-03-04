'use client'

import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge, DELIVERY_DESTINATION_CONFIG } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { generatePurchaseOrders } from '@/app/(dashboard)/purchase-orders/actions'
import { updateSoLinesForPo } from '../actions'
import { SearchableSelect } from '@/components/ui/form-fields'

export interface PoLineCandidate {
  soLineId: string
  productName: string
  sku: string | null
  requiredQty: number
  alreadyAllocated: number
  alreadyOnPo: number
  currentSupplierId: string | null
  currentSupplierName: string | null
  buyPrice: number
  deliveryDestination: string | null
}

interface RaisePoModalProps {
  soId: string
  lines: PoLineCandidate[]
  suppliers: { id: string; name: string }[]
  defaultDeliveryDestination: string
  onClose: () => void
  onSuccess: () => void
}

export function RaisePoModal({
  soId,
  lines,
  suppliers,
  defaultDeliveryDestination,
  onClose,
  onSuccess,
}: RaisePoModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(lines.map(l => l.soLineId))
  })
  const [supplierOverrides, setSupplierOverrides] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const line of lines) {
      if (line.currentSupplierId) {
        defaults[line.soLineId] = line.currentSupplierId
      }
    }
    return defaults
  })
  const [destinationOverride, setDestinationOverride] = useState<string>(defaultDeliveryDestination)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleLine = (lineId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === lines.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(lines.map(l => l.soLineId)))
    }
  }

  const setLineSupplier = (lineId: string, supplierId: string) => {
    setSupplierOverrides(prev => ({ ...prev, [lineId]: supplierId }))
  }

  // Group selected lines by supplier to preview PO batches
  const batches = useMemo(() => {
    const selectedLines = lines.filter(l => selected.has(l.soLineId))
    const groups = new Map<string, { supplierId: string; supplierName: string; destination: string; lines: PoLineCandidate[] }>()
    for (const line of selectedLines) {
      const suppId = supplierOverrides[line.soLineId] || ''
      if (!suppId) continue
      const suppName = suppliers.find(s => s.id === suppId)?.name || 'Unknown'
      const key = `${suppId}__${destinationOverride}`
      if (!groups.has(key)) {
        groups.set(key, { supplierId: suppId, supplierName: suppName, destination: destinationOverride, lines: [] })
      }
      groups.get(key)!.lines.push(line)
    }
    return Array.from(groups.values())
  }, [selected, supplierOverrides, destinationOverride, lines, suppliers])

  const missingSupplier = lines.filter(l => selected.has(l.soLineId) && !supplierOverrides[l.soLineId])
  const canSubmit = selected.size > 0 && missingSupplier.length === 0 && batches.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    const selectedLineIds = Array.from(selected)

    // Update supplier and destination on SO lines before generating POs
    const updates = selectedLineIds.map(lineId => ({
      lineId,
      supplierId: supplierOverrides[lineId],
      deliveryDestination: destinationOverride,
    }))

    const updateResult = await updateSoLinesForPo(soId, updates)
    if ('error' in updateResult && updateResult.error) {
      setError(updateResult.error)
      setLoading(false)
      return
    }

    // Generate POs — lines will be grouped by supplier+destination
    const result = await generatePurchaseOrders({
      soId,
      lineIds: selectedLineIds,
    })

    setLoading(false)
    if ('error' in result && result.error) {
      setError(result.error as string)
    } else {
      onSuccess()
    }
  }

  return (
    <Modal title="Raise Purchase Order" onClose={onClose} width={780}>
      <div className="space-y-4">
        {/* Delivery destination selector */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Delivery Destination
          </label>
          <select
            value={destinationOverride}
            onChange={(e) => setDestinationOverride(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="psd_office">Warehouse (Collect / Re-ship)</option>
            <option value="customer_site">Customer Site (Direct)</option>
          </select>
        </div>

        {/* Lines table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium uppercase text-slate-400">
                <th className="px-5 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === lines.length && lines.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-5 py-3 text-left">Product</th>
                <th className="px-5 py-3 text-right whitespace-nowrap">Qty</th>
                <th className="px-5 py-3 text-right whitespace-nowrap">Unit Cost</th>
                <th className="px-5 py-3 text-right whitespace-nowrap">Line Total</th>
                <th className="px-5 py-3 text-left">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map(line => {
                const isSelected = selected.has(line.soLineId)
                const suppId = supplierOverrides[line.soLineId] || ''
                const orderQty = Math.max(0, line.requiredQty - line.alreadyAllocated - line.alreadyOnPo)
                const lineTotal = orderQty * line.buyPrice

                return (
                  <tr key={line.soLineId} className={isSelected ? 'bg-blue-50/30' : ''}>
                    <td className="px-5 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLine(line.soLineId)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="font-medium">{line.productName}</div>
                      <div className="flex gap-3 text-[11px] text-slate-400">
                        {line.sku && <span className="font-mono">{line.sku}</span>}
                        {(line.alreadyOnPo > 0 || line.alreadyAllocated > 0) && (
                          <span>
                            {line.alreadyOnPo > 0 && <span className="text-indigo-500">{line.alreadyOnPo} on PO</span>}
                            {line.alreadyOnPo > 0 && line.alreadyAllocated > 0 && ' / '}
                            {line.alreadyAllocated > 0 && <span className="text-emerald-500">{line.alreadyAllocated} from stock</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap">
                      {orderQty}
                      {orderQty < line.requiredQty && (
                        <span className="text-slate-400 text-[11px] ml-1">of {line.requiredQty}</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-500 whitespace-nowrap">{formatCurrency(line.buyPrice)}</td>
                    <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap">{formatCurrency(lineTotal)}</td>
                    <td className="px-5 py-2.5">
                      <SearchableSelect
                        size="sm"
                        value={suppId}
                        options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                        placeholder="Select supplier"
                        onChange={(val) => setLineSupplier(line.soLineId, val)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Batch preview */}
        {batches.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              PO Preview ({batches.length} PO{batches.length !== 1 ? 's' : ''} will be created)
            </div>
            {batches.map((batch, i) => {
              const batchTotal = batch.lines.reduce((sum, l) => {
                const qty = Math.max(0, l.requiredQty - l.alreadyAllocated - l.alreadyOnPo)
                return sum + qty * l.buyPrice
              }, 0)
              const destCfg = DELIVERY_DESTINATION_CONFIG[batch.destination as keyof typeof DELIVERY_DESTINATION_CONFIG]
              return (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{batch.supplierName}</span>
                      {destCfg && <Badge label={destCfg.label} color={destCfg.color} bg={destCfg.bg} />}
                    </div>
                    <span className="font-medium">{formatCurrency(batchTotal)}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {batch.lines.length} line{batch.lines.length !== 1 ? 's' : ''}: {batch.lines.map(l => l.productName).join(', ')}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Warnings */}
        {missingSupplier.length > 0 && selected.size > 0 && (
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {missingSupplier.length} selected line{missingSupplier.length !== 1 ? 's' : ''} need a supplier assigned.
          </div>
        )}

        <div className="text-xs text-slate-400">
          Lines will be grouped into POs by supplier. The purchaser has full freedom to order via PO even when stock is available.
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="default" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={handleSubmit} disabled={loading || !canSubmit}>
            {loading ? 'Generating...' : `Generate ${batches.length || ''} PO${batches.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
