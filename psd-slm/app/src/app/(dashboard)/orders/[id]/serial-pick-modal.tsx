'use client'

import { useState, useRef, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { markAsPickedWithSerials, getSerialNumbers, getPoLinkedSerials } from '@/app/(dashboard)/stock/actions'

interface SerialPickModalProps {
  allocationId: string
  productId: string
  productName: string
  serialNumbers: string[]       // allocated serials from the allocation record
  quantityToPick: number
  soLineId?: string             // SO line ID for PO-linked pre-selection
  onClose: () => void
  onSuccess: () => void
}

export function SerialPickModal({
  allocationId,
  productId,
  productName,
  serialNumbers: allocSerials,
  quantityToPick,
  soLineId,
  onClose,
  onSuccess,
}: SerialPickModalProps) {
  const [availableSerials, setAvailableSerials] = useState<string[]>(allocSerials)
  const [loadingSerials, setLoadingSerials] = useState(allocSerials.length === 0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scanInput, setScanInput] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preSelectBanner, setPreSelectBanner] = useState<string | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  // If the allocation has no serial numbers recorded (pre-existing allocation),
  // fetch in_stock + allocated serials from the registry for this product
  useEffect(() => {
    if (allocSerials.length > 0) {
      // Check PO-linked pre-selection for existing alloc serials
      if (soLineId) {
        getPoLinkedSerials(productId, soLineId).then(({ serials: poSerials, poNumber }) => {
          if (poSerials.length > 0) {
            const toPreSelect = allocSerials.filter(sn => poSerials.includes(sn)).slice(0, quantityToPick)
            if (toPreSelect.length > 0) {
              setSelected(new Set(toPreSelect))
              setPreSelectBanner(`All ${toPreSelect.length} serial${toPreSelect.length !== 1 ? 's' : ''} pre-selected (from ${poNumber || 'linked PO'})`)
            }
          }
        })
      }
      scanRef.current?.focus()
      return
    }
    setLoadingSerials(true)
    // Fetch both in_stock and allocated serials — the picker needs to choose from what's physically available
    const serialsPromise = Promise.all([
      getSerialNumbers(productId, 'in_stock'),
      getSerialNumbers(productId, 'allocated'),
    ])
    const poPromise = soLineId
      ? getPoLinkedSerials(productId, soLineId)
      : Promise.resolve({ serials: [] as string[], poNumber: null as string | null })

    Promise.all([serialsPromise, poPromise]).then(([[inStock, allocated], { serials: poSerials, poNumber }]) => {
      const all = [...inStock, ...allocated].map(s => s.serial_number)
      setAvailableSerials(all)

      // Pre-select PO-linked serials if they match
      if (poSerials.length > 0) {
        const toPreSelect = all.filter(sn => poSerials.includes(sn)).slice(0, quantityToPick)
        if (toPreSelect.length > 0) {
          setSelected(new Set(toPreSelect))
          setPreSelectBanner(`All ${toPreSelect.length} serial${toPreSelect.length !== 1 ? 's' : ''} pre-selected (from ${poNumber || 'linked PO'})`)
        }
      }

      setLoadingSerials(false)
      setTimeout(() => scanRef.current?.focus(), 100)
    })
  }, [productId, allocSerials, soLineId, quantityToPick])

  const toggleSerial = (sn: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(sn)) {
        next.delete(sn)
      } else if (next.size < quantityToPick) {
        next.add(sn)
      }
      return next
    })
    setScanError(null)
  }

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const scanned = scanInput.trim()
    if (!scanned) return

    if (!availableSerials.includes(scanned)) {
      setScanError('Serial not found')
      setTimeout(() => setScanError(null), 2000)
      setScanInput('')
      return
    }

    if (selected.has(scanned)) {
      setScanError('Already selected')
      setTimeout(() => setScanError(null), 1500)
      setScanInput('')
      return
    }

    if (selected.size >= quantityToPick) {
      setScanError('All serials already selected')
      setTimeout(() => setScanError(null), 1500)
      setScanInput('')
      return
    }

    setSelected(prev => new Set(prev).add(scanned))
    setScanError(null)
    setScanInput('')
  }

  const handleSubmit = async () => {
    if (selected.size !== quantityToPick) {
      setError(`Select exactly ${quantityToPick} serial(s). You selected ${selected.size}.`)
      return
    }

    setLoading(true)
    setError(null)

    const result = await markAsPickedWithSerials({
      allocationId,
      pickedSerials: Array.from(selected),
    })

    setLoading(false)
    if ('error' in result) {
      setError(result.error as string)
    } else {
      onSuccess()
    }
  }

  return (
    <Modal title="Pick Serialised Items" onClose={onClose} width={640}>
      <div className="space-y-4">
        {/* Product info */}
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-medium">{productName}</div>
          <div className="text-xs text-slate-500 mt-1">
            Select {quantityToPick} serial number{quantityToPick !== 1 ? 's' : ''} to pick
          </div>
        </div>

        {/* Barcode scanner input */}
        <div>
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

        {/* PO-linked pre-selection banner */}
        {preSelectBanner && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            {preSelectBanner}
          </div>
        )}

        {/* Counter + Select All / Deselect All */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Selected {selected.size} of {quantityToPick}
          </span>
          <div className="flex items-center gap-3">
            {availableSerials.length > 0 && !loadingSerials && (
              <button
                onClick={() => {
                  if (selected.size === Math.min(availableSerials.length, quantityToPick)) {
                    setSelected(new Set())
                    setPreSelectBanner(null)
                  } else {
                    setSelected(new Set(availableSerials.slice(0, quantityToPick)))
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {selected.size === Math.min(availableSerials.length, quantityToPick) ? 'Deselect All' : 'Select All'}
              </button>
            )}
            {selected.size > 0 && (
              <button
                onClick={() => { setSelected(new Set()); setPreSelectBanner(null) }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Tap-to-select serial grid */}
        {loadingSerials ? (
          <div className="text-center py-8 text-sm text-slate-400">Loading serial numbers...</div>
        ) : availableSerials.length === 0 ? (
          <div className="text-center py-8 text-sm text-amber-600 bg-amber-50 rounded-lg">
            No serial numbers found for this product. Serials may need to be registered via goods receipt first.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto">
            {availableSerials.map(sn => {
              const isSelected = selected.has(sn)
              const isDisabled = !isSelected && selected.size >= quantityToPick
              return (
                <button
                  key={sn}
                  type="button"
                  onClick={() => !isDisabled && toggleSerial(sn)}
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
                    <span className="truncate">{sn}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="default" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || selected.size !== quantityToPick}
          >
            {loading ? 'Picking...' : `Confirm Pick (${selected.size}/${quantityToPick})`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
