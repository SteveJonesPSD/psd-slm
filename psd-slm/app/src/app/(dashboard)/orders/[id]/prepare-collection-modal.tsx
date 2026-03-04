'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createCollection } from '@/lib/collections/actions'
import type { CreateCollectionLineInput } from '@/lib/collections/types'

interface DispatchableLine {
  soLineId: string
  productId: string
  description: string
  quantity: number
  serialNumbers: string[]
}

interface PrepareCollectionModalProps {
  soId: string
  dispatchableLines: DispatchableLine[]
  onClose: () => void
  onSuccess: () => void
}

export function PrepareCollectionModal({
  soId,
  dispatchableLines,
  onClose,
  onSuccess,
}: PrepareCollectionModalProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(dispatchableLines.map(l => l.soLineId))
  )
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleLine = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    const selected = dispatchableLines.filter(l => selectedIds.has(l.soLineId))
    if (selected.length === 0) {
      setError('Select at least one line.')
      return
    }

    setCreating(true)
    setError(null)

    const lineItems: CreateCollectionLineInput[] = selected.map((l, idx) => ({
      sales_order_line_id: l.soLineId,
      product_id: l.productId,
      description: l.description,
      quantity_expected: l.quantity,
      expected_serials: l.serialNumbers.length > 0 ? l.serialNumbers : undefined,
      sort_order: idx,
    }))

    const result = await createCollection(null, soId, lineItems, notes.trim() || undefined)

    if (result.error) {
      setError(result.error)
      setCreating(false)
      return
    }

    // Open the PDF slip in a new tab
    if (result.id) {
      window.open(`/api/collections/${result.id}/slip`, '_blank')
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-slate-900">Prepare Collection Slip</h3>
          <p className="text-sm text-slate-500 mt-1">
            Select picked items for the engineer to collect from the warehouse
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {dispatchableLines.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">
              No picked items available for collection
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {dispatchableLines.map(line => {
                const isSelected = selectedIds.has(line.soLineId)

                return (
                  <button
                    key={line.soLineId}
                    type="button"
                    onClick={() => toggleLine(line.soLineId)}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      isSelected ? 'bg-slate-50 border-slate-300' : 'bg-white border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">
                          {line.quantity}× {line.description}
                        </div>
                        {line.serialNumbers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {line.serialNumbers.map(sn => (
                              <span key={sn} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                                {sn}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2 boxes on shelf B3 + 1 cable reel"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
            />
          </div>

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="default" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={creating || selectedIds.size === 0}
          >
            {creating ? 'Creating…' : `Generate Slip (${selectedIds.size} items)`}
          </Button>
        </div>
      </div>
    </div>
  )
}
