'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, FULFILMENT_STATUS_CONFIG, FULFILMENT_ROUTE_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { markAsPicked, unallocateStockFromSoLine } from '@/app/(dashboard)/stock/actions'
import { resolveSerialisedStatus } from '@/lib/products'
import { AllocateStockModal } from './allocate-stock-modal'
import { SerialPickModal } from './serial-pick-modal'
import { RaisePoModal } from './raise-po-modal'
import type { PoLineCandidate } from './raise-po-modal'
import { CreateDnModal } from './create-dn-modal'
import { PrepareCollectionModal } from './prepare-collection-modal'
import type { SoLineFulfilment, StockAllocation } from '@/types/database'

interface FulfilmentLine extends SoLineFulfilment {
  products?: { id: string; name: string; sku: string; is_serialised: boolean | null } | null
}

interface SoLineData {
  id: string
  description: string
  buy_price: number
  supplier_id: string | null
  suppliers: { id: string; name: string } | null
  delivery_destination: string | null
  status: string
  is_service: boolean
  products: {
    id: string
    name: string
    sku: string
    is_stocked: boolean
    is_serialised: boolean | null
    product_type?: 'goods' | 'service'
    product_categories?: { requires_serial: boolean } | null
  } | null
}

/** Resolve whether an SO line's product is effectively serialised (handles tri-state + category inheritance) */
function isLineSerialized(soLine: SoLineData | undefined): boolean {
  if (!soLine?.products) return false
  const p = soLine.products
  const catRequires = p.product_categories?.requires_serial ?? false
  return resolveSerialisedStatus(p.is_serialised, catRequires, p.product_type)
}

interface SoFulfilmentSectionProps {
  soId: string
  customerId: string
  fulfilmentLines: FulfilmentLine[]
  allocations: (StockAllocation & { stock_locations?: { id: string; name: string; code: string } | null })[]
  stockAvailability: Record<string, number>
  deliveryAddress: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    postcode?: string | null
  }
  suppliers: { id: string; name: string }[]
  soLines?: SoLineData[]
}

export function SoFulfilmentSection({
  soId,
  customerId,
  fulfilmentLines,
  allocations,
  stockAvailability,
  deliveryAddress,
  suppliers,
  soLines = [],
}: SoFulfilmentSectionProps) {
  const router = useRouter()
  const [allocateModal, setAllocateModal] = useState<FulfilmentLine | null>(null)
  const [allocatePickMode, setAllocatePickMode] = useState(false)
  // raisePoLines: when set, opens the Raise PO modal with these lines pre-selected
  const [raisePoLines, setRaisePoLines] = useState<PoLineCandidate[] | null>(null)
  const [createDnOpen, setCreateDnOpen] = useState(false)
  const [prepareCollectionOpen, setPrepareCollectionOpen] = useState(false)
  const [pickingAll, setPickingAll] = useState(false)
  const [unallocateModal, setUnallocateModal] = useState<{
    soLineId: string
    description: string
    serials: string[]
    totalQty: number
  } | null>(null)
  const [unallocateReason, setUnallocateReason] = useState('')
  const [unallocateLoading, setUnallocateLoading] = useState(false)
  const [unallocateError, setUnallocateError] = useState<string | null>(null)
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [serialPickAlloc, setSerialPickAlloc] = useState<{
    allocationId: string
    productId: string
    productName: string
    serialNumbers: string[]
    quantityToPick: number
    soLineId: string
  } | null>(null)

  // Filter to goods lines only (exclude service items and terminal statuses)
  const goodsLines = fulfilmentLines.filter(
    l => !l.is_service && !['delivered', 'cancelled'].includes(l.line_status)
  )

  if (goodsLines.length === 0) return null

  // Summary counts
  const needsAction = goodsLines.filter(l => l.fulfilment_status === 'needs_action').length
  const covered = goodsLines.filter(l => l.fulfilment_status === 'covered').length
  const ready = goodsLines.filter(l => l.fulfilment_status === 'ready').length
  const total = goodsLines.length

  // Find allocations that can be picked
  const pickableAllocations = allocations.filter(a => a.status === 'allocated')

  // Lines ready for delivery note:
  // - 'picked' lines (from_stock items that have been allocated + picked)
  // - 'received' lines ONLY if drop_ship (from_stock received items still need allocation + pick)
  const dispatchableLines = fulfilmentLines.filter(l => {
    if (l.is_service || ['delivered', 'cancelled'].includes(l.line_status)) return false
    if (l.line_status === 'picked') return true
    if (l.line_status === 'received' && l.fulfilment_route === 'drop_ship') return true
    return false
  })

  // Build PO-eligible line candidates from SO lines + fulfilment data
  const buildPoCandidate = (line: FulfilmentLine): PoLineCandidate | null => {
    const soLine = soLines.find(sl => sl.id === line.so_line_id)
    if (!soLine) return null
    if (soLine.status !== 'pending' || soLine.is_service) return null

    return {
      soLineId: line.so_line_id,
      productName: line.description,
      sku: soLine.products?.sku || null,
      requiredQty: line.required_qty,
      alreadyAllocated: line.qty_allocated,
      alreadyOnPo: line.qty_on_po,
      currentSupplierId: soLine.supplier_id,
      currentSupplierName: soLine.suppliers?.name || null,
      buyPrice: soLine.buy_price,
      deliveryDestination: soLine.delivery_destination,
    }
  }

  // All goods lines eligible for PO (pending, non-service)
  const allPoEligible = goodsLines
    .map(buildPoCandidate)
    .filter((c): c is PoLineCandidate => c !== null)

  // Lines with unallocated qty that still need ordering
  const linesNeedingPo = allPoEligible.filter(c => {
    const remaining = c.requiredQty - c.alreadyAllocated - c.alreadyOnPo
    return remaining > 0
  })

  const defaultDest = soLines.find(l => l.delivery_destination)?.delivery_destination || 'psd_office'

  const openRaisePoForLine = (line: FulfilmentLine) => {
    // Open modal with all eligible lines, but the clicked line will be the only one in the list
    // if there's only one — otherwise show all eligible so user can combine
    const candidate = buildPoCandidate(line)
    if (!candidate) return
    // Show all PO-eligible lines so the user can combine, but pre-select the clicked one
    setRaisePoLines(allPoEligible.length > 1 ? allPoEligible : [candidate])
  }

  const openRaisePoAll = () => {
    setRaisePoLines(linesNeedingPo.length > 0 ? linesNeedingPo : allPoEligible)
  }

  const openRaisePoSelected = () => {
    const selected = allPoEligible.filter(c => selectedLines.has(c.soLineId))
    if (selected.length > 0) setRaisePoLines(selected)
  }

  const showSelectionCheckboxes = allPoEligible.length > 1

  const toggleFulfilmentSelection = (soLineId: string) => {
    setSelectedLines(prev => {
      const next = new Set(prev)
      if (next.has(soLineId)) next.delete(soLineId)
      else next.add(soLineId)
      return next
    })
  }

  const toggleAllFulfilment = () => {
    if (selectedLines.size === allPoEligible.length) {
      setSelectedLines(new Set())
    } else {
      setSelectedLines(new Set(allPoEligible.map(c => c.soLineId)))
    }
  }

  // Split pickable allocations into serialised vs non-serialised
  const nonSerialisedPickable = pickableAllocations.filter(a => {
    const soLine = soLines.find(sl => sl.id === a.sales_order_line_id)
    return !isLineSerialized(soLine)
  })
  const serialisedPickable = pickableAllocations.filter(a => {
    const soLine = soLines.find(sl => sl.id === a.sales_order_line_id)
    return isLineSerialized(soLine)
  })

  const handleMarkAllPicked = async () => {
    if (nonSerialisedPickable.length === 0) return
    setPickingAll(true)
    const result = await markAsPicked({ allocationIds: nonSerialisedPickable.map(a => a.id) })
    setPickingAll(false)
    if ('error' in result) {
      alert(result.error)
    } else {
      if ('serialisedSkipped' in result && result.serialisedSkipped && (result.serialisedSkipped as string[]).length > 0) {
        alert(result.message)
      }
      router.refresh()
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-6">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-[15px] font-semibold">Fulfilment</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {allPoEligible.length > 0 && (
              <>
                {selectedLines.size > 0 && (
                  <Button size="sm" variant="blue" onClick={openRaisePoSelected}>
                    Generate PO for Selected ({selectedLines.size})
                  </Button>
                )}
                <Button size="sm" variant="primary" onClick={openRaisePoAll}>
                  Generate All POs ({allPoEligible.length})
                </Button>
              </>
            )}
            {nonSerialisedPickable.length > 0 && (
              <Button size="sm" variant="blue" onClick={handleMarkAllPicked} disabled={pickingAll}>
                {pickingAll ? 'Picking...' : `Mark All Picked (${nonSerialisedPickable.length})`}
              </Button>
            )}
            {serialisedPickable.length > 0 && nonSerialisedPickable.length === 0 && pickableAllocations.length > 0 && (
              <span className="text-xs text-amber-600 px-2 py-1 bg-amber-50 rounded-lg border border-amber-200">
                {serialisedPickable.length} serialised allocation{serialisedPickable.length !== 1 ? 's' : ''} — pick individually
              </span>
            )}
            {dispatchableLines.length > 0 && (
              <Button size="sm" variant="default" onClick={() => setPrepareCollectionOpen(true)}>
                Prepare for Collection ({dispatchableLines.length})
              </Button>
            )}
            {dispatchableLines.length > 0 && (
              <Button size="sm" variant="primary" onClick={() => setCreateDnOpen(true)}>
                Create Delivery Note ({dispatchableLines.length})
              </Button>
            )}
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs text-slate-500">
              Needs Action: <strong className="text-red-600">{needsAction}</strong> of {total}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-xs text-slate-500">
              Covered: <strong className="text-amber-600">{covered}</strong> of {total}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">
              Ready: <strong className="text-emerald-600">{ready}</strong> of {total}
            </span>
          </div>
          {/* Progress bar */}
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div className="bg-emerald-500 transition-all" style={{ width: `${(ready / total) * 100}%` }} />
              <div className="bg-amber-400 transition-all" style={{ width: `${(covered / total) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Per-line fulfilment table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-xs font-medium uppercase text-slate-400 border-b border-gray-100">
              {showSelectionCheckboxes && (
                <th className="pl-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedLines.size === allPoEligible.length && allPoEligible.length > 0}
                    onChange={toggleAllFulfilment}
                    className="rounded border-slate-300"
                  />
                </th>
              )}
              <th className="px-5 py-3 text-left">Product</th>
              <th className="px-5 py-3 text-left">Route</th>
              <th className="px-5 py-3 text-right">Required</th>
              <th className="px-5 py-3 text-right">Available</th>
              <th className="px-5 py-3 text-right">Allocated</th>
              <th className="px-5 py-3 text-right">On PO</th>
              <th className="px-5 py-3 text-right">Picked</th>
              <th className="px-5 py-3 text-right">Unallocated</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {goodsLines.map(line => {
              const available = line.product_id ? (stockAvailability[line.product_id] || 0) : 0
              const fsCfg = FULFILMENT_STATUS_CONFIG[line.fulfilment_status]
              const routeCfg = FULFILMENT_ROUTE_CONFIG[line.fulfilment_route as keyof typeof FULFILMENT_ROUTE_CONFIG]
              const unallocated = Math.max(0, line.qty_unallocated)
              const lineAllocations = allocations.filter(a => a.sales_order_line_id === line.so_line_id && a.status !== 'cancelled')
              const allocatedAllocs = lineAllocations.filter(a => a.status === 'allocated')
              const soLine = soLines.find(sl => sl.id === line.so_line_id)
              const isSerialized = isLineSerialized(soLine)
              const canRaisePo = soLine?.status === 'pending' && !soLine.is_service

              const isPoEligible = allPoEligible.some(c => c.soLineId === line.so_line_id)

              return (
                <tr key={line.so_line_id} className="hover:bg-slate-50/50">
                  {showSelectionCheckboxes && (
                    <td className="pl-3 py-2.5 w-8">
                      {isPoEligible && (
                        <input
                          type="checkbox"
                          checked={selectedLines.has(line.so_line_id)}
                          onChange={() => toggleFulfilmentSelection(line.so_line_id)}
                          className="rounded border-slate-300"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{line.description}</div>
                    {line.product_id && (
                      <div className="text-xs text-slate-400 font-mono">
                        {(line as FulfilmentLine).products?.sku}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap">
                    {routeCfg ? <Badge label={routeCfg.label} color={routeCfg.color} bg={routeCfg.bg} /> : line.fulfilment_route}
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium">{line.required_qty}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={available > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                      {available}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {line.qty_allocated > 0 ? (
                      <span className="text-blue-600 font-medium">{line.qty_allocated}</span>
                    ) : '\u2014'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {line.qty_on_po > 0 ? (
                      <span className="text-indigo-600 font-medium">
                        {line.qty_on_po}
                        {line.qty_po_received > 0 && (
                          <span className="text-emerald-600 ml-1">({line.qty_po_received} rcvd)</span>
                        )}
                      </span>
                    ) : '\u2014'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {line.qty_picked > 0 ? (
                      <span className="text-emerald-600 font-medium">{line.qty_picked}</span>
                    ) : '\u2014'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {unallocated > 0 ? (
                      <span className="text-red-600 font-semibold">{unallocated}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-center whitespace-nowrap">
                    {fsCfg && <Badge label={fsCfg.label} color={fsCfg.color} bg={fsCfg.bg} />}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {available > 0 && line.qty_allocated < line.required_qty && (
                        <button
                          onClick={() => { setAllocatePickMode(true); setAllocateModal(line) }}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-colors whitespace-nowrap"
                        >
                          Pick from Free Stock ({available})
                        </button>
                      )}
                      {canRaisePo && (
                        <button
                          onClick={() => openRaisePoForLine(line)}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors whitespace-nowrap"
                        >
                          Raise PO
                        </button>
                      )}
                      {allocatedAllocs.length > 0 && isSerialized && allocatedAllocs.map(alloc => (
                        <button
                          key={alloc.id}
                          onClick={() => {
                            const qtyToPick = alloc.quantity_allocated - alloc.quantity_picked
                            setSerialPickAlloc({
                              allocationId: alloc.id,
                              productId: alloc.product_id,
                              productName: line.description,
                              serialNumbers: alloc.serial_numbers || [],
                              quantityToPick: qtyToPick,
                              soLineId: line.so_line_id,
                            })
                          }}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors whitespace-nowrap"
                        >
                          Pick (select serials)
                        </button>
                      ))}
                      {allocatedAllocs.length > 0 && !isSerialized && (
                        <button
                          onClick={async () => {
                            const ids = allocatedAllocs.map(a => a.id)
                            const result = await markAsPicked({ allocationIds: ids })
                            if ('error' in result) alert(result.error)
                            else router.refresh()
                          }}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors whitespace-nowrap"
                        >
                          Pick
                        </button>
                      )}
                      {lineAllocations.length > 0 && (
                        <button
                          onClick={() => {
                            const allSerials = lineAllocations.flatMap(a => a.serial_numbers || [])
                            const totalAllocQty = lineAllocations.reduce((sum, a) => sum + a.quantity_allocated, 0)
                            setUnallocateModal({
                              soLineId: line.so_line_id,
                              description: line.description,
                              serials: allSerials,
                              totalQty: totalAllocQty,
                            })
                            setUnallocateReason('')
                            setUnallocateError(null)
                          }}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-50 border border-amber-200 transition-colors whitespace-nowrap"
                        >
                          Unallocate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Allocate Stock Modal */}
      {allocateModal && (
        <AllocateStockModal
          soLineId={allocateModal.so_line_id}
          productId={allocateModal.product_id!}
          productName={allocateModal.description}
          requiredQty={allocateModal.required_qty}
          alreadyAllocated={allocateModal.qty_allocated}
          alreadyOnPo={allocateModal.qty_on_po}
          available={allocateModal.product_id ? (stockAvailability[allocateModal.product_id] || 0) : 0}
          isSerialized={isLineSerialized(soLines.find(sl => sl.id === allocateModal.so_line_id))}
          pickMode={allocatePickMode}
          onClose={() => { setAllocateModal(null); setAllocatePickMode(false) }}
          onSuccess={() => { setAllocateModal(null); setAllocatePickMode(false); router.refresh() }}
        />
      )}

      {/* Raise PO Modal */}
      {raisePoLines && (
        <RaisePoModal
          soId={soId}
          lines={raisePoLines}
          suppliers={suppliers}
          defaultDeliveryDestination={defaultDest}
          onClose={() => setRaisePoLines(null)}
          onSuccess={() => { setRaisePoLines(null); router.refresh() }}
        />
      )}

      {/* Serial Pick Modal */}
      {serialPickAlloc && (
        <SerialPickModal
          allocationId={serialPickAlloc.allocationId}
          productId={serialPickAlloc.productId}
          productName={serialPickAlloc.productName}
          serialNumbers={serialPickAlloc.serialNumbers}
          quantityToPick={serialPickAlloc.quantityToPick}
          soLineId={serialPickAlloc.soLineId}
          onClose={() => setSerialPickAlloc(null)}
          onSuccess={() => { setSerialPickAlloc(null); router.refresh() }}
        />
      )}

      {/* Unallocate Confirmation Modal */}
      {unallocateModal && (
        <Modal title="Unallocate Stock" onClose={() => setUnallocateModal(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              This will return all allocated stock for <strong>{unallocateModal.description}</strong> back to free stock.
            </div>

            <div className="text-sm space-y-1">
              <p><span className="text-slate-500">Quantity:</span> <strong>{unallocateModal.totalQty}</strong></p>
              {unallocateModal.serials.length > 0 && (
                <div>
                  <p className="text-slate-500 mb-1">Serials being returned:</p>
                  <div className="flex flex-wrap gap-1">
                    {unallocateModal.serials.map(sn => (
                      <span key={sn} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">{sn}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={unallocateReason}
                onChange={(e) => setUnallocateReason(e.target.value)}
                rows={2}
                placeholder="e.g. Emergency reallocation to SO-2026-0087 for Customer B"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>

            {unallocateError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {unallocateError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="default" onClick={() => setUnallocateModal(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={unallocateLoading || unallocateReason.trim().length < 3}
                onClick={async () => {
                  setUnallocateLoading(true)
                  setUnallocateError(null)
                  const result = await unallocateStockFromSoLine(unallocateModal.soLineId, unallocateReason.trim())
                  setUnallocateLoading(false)
                  if ('error' in result && result.error) {
                    setUnallocateError(result.error)
                  } else {
                    setUnallocateModal(null)
                    router.refresh()
                  }
                }}
              >
                {unallocateLoading ? 'Unallocating...' : 'Unallocate to Free Stock'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Delivery Note Modal */}
      {createDnOpen && (
        <CreateDnModal
          soId={soId}
          dispatchableLines={dispatchableLines.map(l => {
            const lineAllocs = allocations.filter(a => a.sales_order_line_id === l.so_line_id && a.status !== 'cancelled')
            const serials = lineAllocs.flatMap(a => a.serial_numbers || [])
            return {
              soLineId: l.so_line_id,
              productId: l.product_id,
              description: l.description,
              quantity: l.required_qty,
              isSerialized: isLineSerialized(soLines.find(sl => sl.id === l.so_line_id)),
              serialNumbers: serials,
            }
          })}
          deliveryAddress={deliveryAddress}
          onClose={() => setCreateDnOpen(false)}
          onSuccess={() => { setCreateDnOpen(false); router.refresh() }}
        />
      )}

      {/* Prepare for Collection Modal */}
      {prepareCollectionOpen && (
        <PrepareCollectionModal
          soId={soId}
          dispatchableLines={dispatchableLines.map(l => {
            const lineAllocs = allocations.filter(a => a.sales_order_line_id === l.so_line_id && a.status !== 'cancelled')
            const serials = lineAllocs.flatMap(a => a.serial_numbers || [])
            return {
              soLineId: l.so_line_id,
              productId: l.product_id!,
              description: l.description,
              quantity: l.required_qty,
              serialNumbers: serials,
            }
          })}
          onClose={() => setPrepareCollectionOpen(false)}
          onSuccess={() => { setPrepareCollectionOpen(false); router.refresh() }}
        />
      )}
    </div>
  )
}
