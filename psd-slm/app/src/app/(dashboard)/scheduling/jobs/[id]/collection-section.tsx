'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { getCollectionsForJob, createCollection } from '@/lib/collections/actions'
import type { CreateCollectionLineInput } from '@/lib/collections/types'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  collected: { label: 'Collected', color: '#059669', bg: '#ecfdf5' },
  partial: { label: 'Partial', color: '#2563eb', bg: '#eff6ff' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CollectionSection({ jobId, salesOrderId, canCreate }: { jobId: string; salesOrderId: string | null; canCreate: boolean }) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPrepareModal, setShowPrepareModal] = useState(false)

  useEffect(() => {
    getCollectionsForJob(jobId).then((data) => {
      setCollections(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [jobId])

  if (loading) {
    return <div className="text-sm text-slate-400 py-4">Loading collections…</div>
  }

  const activeCollections = collections.filter((c) => c.status !== 'cancelled')

  return (
    <div>
      {activeCollections.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-slate-400 text-sm mb-3">No collection slips for this job</div>
          {canCreate && salesOrderId && (
            <Button variant="primary" size="sm" onClick={() => setShowPrepareModal(true)}>
              Prepare for Collection
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {activeCollections.map((col) => {
            const badge = STATUS_BADGE[col.status] || STATUS_BADGE.pending
            const lines = col.job_collection_lines || []
            const confirmedCount = lines.filter((l: { is_confirmed: boolean }) => l.is_confirmed).length
            const preparedBy = col.prepared_by_user as { first_name: string; last_name: string; initials: string; color: string; avatar_url: string | null } | null
            const collectedBy = col.collected_by_user as { first_name: string; last_name: string; initials: string; color: string; avatar_url: string | null } | null

            return (
              <div key={col.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/collections/${col.id}`} className="text-sm font-semibold text-indigo-600 hover:underline">
                    {col.slip_number}
                  </Link>
                  <Badge label={badge.label} color={badge.color} bg={badge.bg} />
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div>{lines.length} item{lines.length !== 1 ? 's' : ''}{col.status === 'partial' ? ` (${confirmedCount} confirmed)` : ''}</div>
                  {preparedBy && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Prepared:</span>
                      <Avatar user={preparedBy} size={18} />
                      <span>{preparedBy.first_name} {preparedBy.last_name}</span>
                      {col.prepared_at && (
                        <span className="text-slate-400">
                          {new Date(col.prepared_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  )}
                  {collectedBy && col.collected_at && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Collected:</span>
                      <Avatar user={collectedBy} size={18} />
                      <span>{collectedBy.first_name} {collectedBy.last_name}</span>
                      <span className="text-slate-400">
                        {new Date(col.collected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => window.open(`/api/collections/${col.id}/slip`, '_blank')}
                  >
                    Print Slip
                  </Button>
                  <Link href={`/collections/${col.id}`}>
                    <Button variant="ghost" size="sm">View Details</Button>
                  </Link>
                </div>
              </div>
            )
          })}

          {canCreate && salesOrderId && (
            <Button variant="default" size="sm" onClick={() => setShowPrepareModal(true)}>
              + New Collection
            </Button>
          )}
        </div>
      )}

      {showPrepareModal && salesOrderId && (
        <PrepareCollectionModal
          jobId={jobId}
          salesOrderId={salesOrderId}
          onClose={() => setShowPrepareModal(false)}
          onCreated={(collectionId) => {
            setShowPrepareModal(false)
            window.open(`/api/collections/${collectionId}/slip`, '_blank')
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function PrepareCollectionModal({
  jobId,
  salesOrderId,
  onClose,
  onCreated,
}: {
  jobId: string
  salesOrderId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [soLines, setSoLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Fetch SO lines that are picked (ready for collection)
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase
        .from('sales_order_lines')
        .select('id, description, quantity, product_id, products(id, sku, name)')
        .eq('sales_order_id', salesOrderId)
        .in('status', ['picked', 'pending', 'ordered', 'received'])
        .order('sort_order', { ascending: true })
        .then(({ data }) => {
          const lines = data || []
          setSoLines(lines)
          // Pre-select all lines
          setSelectedIds(new Set(lines.map((l: { id: string }) => l.id)))
          setLoading(false)
        })
    })
  }, [salesOrderId])

  const handleCreate = async () => {
    const selectedLines = soLines.filter((l) => selectedIds.has(l.id))
    if (selectedLines.length === 0) {
      setError('Select at least one line.')
      return
    }

    setCreating(true)
    setError(null)

    const lineItems: CreateCollectionLineInput[] = selectedLines.map((l, idx) => ({
      sales_order_line_id: l.id,
      product_id: l.product_id || (l.products as { id: string })?.id,
      description: l.description,
      quantity_expected: l.quantity,
      sort_order: idx,
    }))

    const result = await createCollection(jobId, salesOrderId, lineItems, notes.trim() || undefined)

    if (result.error) {
      setError(result.error)
      setCreating(false)
      return
    }

    onCreated(result.id!)
  }

  const toggleLine = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-slate-900">Prepare for Collection</h3>
          <p className="text-sm text-slate-500 mt-1">Select items for the engineer to collect</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-sm text-slate-400 text-center py-8">Loading SO lines…</div>
          ) : soLines.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">No eligible SO lines found</div>
          ) : (
            <div className="space-y-2 mb-4">
              {soLines.map((line) => {
                const product = line.products as { sku: string; name: string } | null
                const isSelected = selectedIds.has(line.id)

                return (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => toggleLine(line.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      isSelected ? 'bg-slate-50 border-slate-300' : 'bg-white border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
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
                        {product?.sku && (
                          <div className="text-xs text-slate-400">{product.sku}</div>
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
              placeholder="e.g. 2 boxes + 1 cable reel"
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
