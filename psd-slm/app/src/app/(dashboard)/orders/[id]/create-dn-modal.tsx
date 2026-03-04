'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createDeliveryNote } from '@/app/(dashboard)/delivery-notes/actions'

interface DispatchableLine {
  soLineId: string
  productId: string | null
  description: string
  quantity: number
  isSerialized: boolean
  serialNumbers: string[]
}

interface CreateDnModalProps {
  soId: string
  dispatchableLines: DispatchableLine[]
  deliveryAddress: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    postcode?: string | null
  }
  onClose: () => void
  onSuccess: () => void
}

export function CreateDnModal({
  soId,
  dispatchableLines,
  deliveryAddress,
  onClose,
  onSuccess,
}: CreateDnModalProps) {
  const [selectedLines, setSelectedLines] = useState<Set<string>>(
    new Set(dispatchableLines.map(l => l.soLineId))
  )
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleLine = (lineId: string) => {
    setSelectedLines(prev => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const handleSubmit = async () => {
    const selected = dispatchableLines.filter(l => selectedLines.has(l.soLineId))
    if (selected.length === 0) {
      setError('Select at least one line.')
      return
    }

    setLoading(true)
    setError(null)

    const result = await createDeliveryNote({
      soId,
      lines: selected.map(l => ({
        soLineId: l.soLineId,
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        serialNumbers: l.serialNumbers,
      })),
      deliveryAddressLine1: deliveryAddress.line1 || undefined,
      deliveryAddressLine2: deliveryAddress.line2 || undefined,
      deliveryCity: deliveryAddress.city || undefined,
      deliveryPostcode: deliveryAddress.postcode || undefined,
      carrier: carrier || undefined,
      trackingReference: tracking || undefined,
      notes: notes || undefined,
    })

    setLoading(false)
    if ('error' in result) {
      setError(result.error as string)
    } else {
      onSuccess()
    }
  }

  return (
    <Modal title="Create Delivery Note" onClose={onClose}>
      <div className="space-y-4">
        {/* Lines selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Lines to Dispatch</label>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {dispatchableLines.map(line => (
              <label
                key={line.soLineId}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedLines.has(line.soLineId)}
                  onChange={() => toggleLine(line.soLineId)}
                  className="rounded border-slate-300"
                />
                <div className="flex-1 text-sm">
                  <span className="font-medium">{line.description}</span>
                  <span className="ml-2 text-slate-400">x{line.quantity}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Delivery address (read-only preview) */}
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="text-xs font-medium text-slate-400 uppercase mb-1">Delivery Address</div>
          <div className="text-slate-700">
            {[deliveryAddress.line1, deliveryAddress.line2, deliveryAddress.city, deliveryAddress.postcode]
              .filter(Boolean)
              .join(', ') || 'No address set'}
          </div>
        </div>

        {/* Carrier & Tracking */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Carrier</label>
            <input
              type="text"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="e.g. DPD, Royal Mail"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tracking Ref</label>
            <input
              type="text"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="Tracking number"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="Delivery instructions, special handling..."
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="default" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={handleSubmit} disabled={loading || selectedLines.size === 0}>
            {loading ? 'Creating...' : `Create Delivery Note (${selectedLines.size} lines)`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
