'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
import { allocateStock, allocateAndPickFromStock, getAvailableSerials, getStockLocations } from '@/app/(dashboard)/stock/actions'
import type { StockLocation } from '@/types/database'

interface AllocateStockModalProps {
  soLineId: string
  productId: string
  productName: string
  requiredQty: number
  alreadyAllocated: number
  alreadyOnPo: number
  available: number
  isSerialized: boolean
  pickMode?: boolean
  onClose: () => void
  onSuccess: () => void
}

interface SerialOption {
  id: string
  serial_number: string
  status: string
}

export function AllocateStockModal({
  soLineId,
  productId,
  productName,
  requiredQty,
  alreadyAllocated,
  alreadyOnPo,
  available,
  isSerialized,
  pickMode = false,
  onClose,
  onSuccess,
}: AllocateStockModalProps) {
  // Allow allocating up to required minus already allocated (don't subtract PO qty —
  // PO-received goods are now in stock and still need formal allocation + picking)
  const stillNeedsAllocation = Math.max(0, requiredQty - alreadyAllocated)
  const maxAllocatable = Math.min(available, stillNeedsAllocation)

  const [quantity, setQuantity] = useState(maxAllocatable)
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [locationId, setLocationId] = useState('')
  const [availableSerials, setAvailableSerials] = useState<SerialOption[]>([])
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set())
  const [scanInput, setScanInput] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getStockLocations().then(locs => {
      setLocations(locs)
      const def = locs.find(l => l.is_default)
      if (def) setLocationId(def.id)
      else if (locs.length > 0) setLocationId(locs[0].id)
    })

    if (isSerialized) {
      getAvailableSerials(productId).then(serials => {
        setAvailableSerials(serials.map(s => ({
          id: s.id,
          serial_number: s.serial_number,
          status: s.status,
        })))
      })
    }
  }, [productId, isSerialized])

  const toggleSerial = (sn: string) => {
    setSelectedSerials(prev => {
      const next = new Set(prev)
      if (next.has(sn)) next.delete(sn)
      else if (next.size < quantity) next.add(sn)
      return next
    })
    setScanError(null)
  }

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const scanned = scanInput.trim()
    if (!scanned) return

    const match = availableSerials.find(s => s.serial_number === scanned)
    if (!match) {
      setScanError('Serial not found in available stock')
      setTimeout(() => setScanError(null), 2000)
      setScanInput('')
      return
    }

    if (selectedSerials.has(scanned)) {
      setScanError('Already selected')
      setTimeout(() => setScanError(null), 1500)
      setScanInput('')
      return
    }

    if (selectedSerials.size >= quantity) {
      setScanError('All serials already selected')
      setTimeout(() => setScanError(null), 1500)
      setScanInput('')
      return
    }

    setSelectedSerials(prev => new Set(prev).add(scanned))
    setScanError(null)
    setScanInput('')
  }

  const handleSubmit = async () => {
    if (isSerialized && selectedSerials.size !== quantity) {
      setError(`Select exactly ${quantity} serial number(s). You selected ${selectedSerials.size}.`)
      return
    }

    setLoading(true)
    setError(null)

    const actionFn = pickMode ? allocateAndPickFromStock : allocateStock
    const result = await actionFn({
      soLineId,
      productId,
      locationId,
      quantity,
      serialNumbers: isSerialized ? Array.from(selectedSerials) : undefined,
    })

    setLoading(false)
    if ('error' in result) {
      setError(result.error as string)
    } else {
      onSuccess()
    }
  }

  return (
    <Modal title={pickMode ? 'Pick from Free Stock' : 'Allocate from Stock'} onClose={onClose} width={isSerialized ? 640 : 600}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-medium">{productName}</div>
          <div className="flex gap-4 mt-1 text-xs text-slate-500 flex-wrap">
            <span>Required: {requiredQty}</span>
            <span>Allocated: {alreadyAllocated}</span>
            <span>On PO: {alreadyOnPo}</span>
            <span className="text-emerald-600 font-medium">Available: {available}</span>
          </div>
        </div>

        <SearchableSelect
          label="Location"
          value={locationId}
          options={locations.map(loc => ({ value: loc.id, label: `${loc.name} (${loc.code})` }))}
          placeholder="Search locations..."
          onChange={setLocationId}
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity to Allocate</label>
          <input
            type="number"
            min={1}
            max={maxAllocatable}
            value={quantity}
            onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 1, maxAllocatable))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>

        {isSerialized && availableSerials.length > 0 && (
          <div>
            {/* Barcode scanner input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Scan / Type Serial
              </label>
              <input
                ref={scanRef}
                type="text"
                value={scanInput}
                onChange={(e) => { setScanInput(e.target.value); setScanError(null) }}
                onKeyDown={handleScan}
                placeholder="Scan barcode or type serial and press Enter"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm font-mono outline-none transition-colors ${
                  scanError
                    ? 'border-red-400 bg-red-50 focus:border-red-500'
                    : 'border-slate-200 focus:border-slate-400'
                }`}
              />
              {scanError && (
                <p className="text-xs text-red-600 mt-1">{scanError}</p>
              )}
            </div>

            {/* Counter */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Selected {selectedSerials.size} of {quantity}
              </span>
              {selectedSerials.size > 0 && (
                <button
                  onClick={() => setSelectedSerials(new Set())}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Tap-to-select serial grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto">
              {availableSerials.map(sn => {
                const isSelected = selectedSerials.has(sn.serial_number)
                const isDisabled = !isSelected && selectedSerials.size >= quantity
                return (
                  <button
                    key={sn.serial_number}
                    type="button"
                    onClick={() => !isDisabled && toggleSerial(sn.serial_number)}
                    disabled={isDisabled}
                    className={`
                      min-h-[48px] rounded-lg border-2 px-3 py-2.5 text-left font-mono text-sm
                      transition-all select-none
                      ${isSelected
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 text-emerald-800'
                        : isDisabled
                          ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="truncate">{sn.serial_number}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="default" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={handleSubmit} disabled={loading || quantity <= 0}>
            {loading
              ? (pickMode ? 'Picking...' : 'Allocating...')
              : (pickMode
                ? `Pick ${quantity} Unit${quantity !== 1 ? 's' : ''}`
                : `Allocate ${quantity} Unit${quantity !== 1 ? 's' : ''}`)
            }
          </Button>
        </div>
      </div>
    </Modal>
  )
}
