'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { findSerial } from './actions'
import Link from 'next/link'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  in_stock: { label: 'In Stock', color: '#059669', bg: '#ecfdf5' },
  allocated: { label: 'Allocated', color: '#2563eb', bg: '#eff6ff' },
  collected: { label: 'Collected', color: '#7c3aed', bg: '#f5f3ff' },
  dispatched: { label: 'Dispatched', color: '#475569', bg: '#f1f5f9' },
  returned: { label: 'Returned', color: '#dc2626', bg: '#fef2f2' },
}

type SerialResult = NonNullable<Awaited<ReturnType<typeof findSerial>>['data']>[number]

interface FindSerialModalProps {
  onClose: () => void
}

export function FindSerialModal({ onClose }: FindSerialModalProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SerialResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    const trimmed = query.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    const res = await findSerial(trimmed)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      setResults(null)
    } else {
      setResults(res.data ?? [])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <Modal title="Find Serial Number" onClose={onClose} width={640}>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter serial number..."
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-slate-400"
          autoFocus
        />
        <Button variant="primary" onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {results !== null && results.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No serial found.</p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => {
            const statusCfg = STATUS_CONFIG[r.status] || { label: r.status, color: '#6b7280', bg: '#f3f4f6' }
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-slate-900">{r.serial_number}</span>
                  <Badge {...statusCfg} />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-slate-400">Product</dt>
                  <dd>
                    {r.product ? (
                      <Link href={`/products/${r.product.id}`} className="text-blue-600 hover:underline" onClick={onClose}>
                        {r.product.name} <span className="text-slate-400 font-mono text-xs">({r.product.sku})</span>
                      </Link>
                    ) : '\u2014'}
                  </dd>

                  <dt className="text-slate-400">Location</dt>
                  <dd>{r.location?.name || '\u2014'}</dd>

                  <dt className="text-slate-400">Customer</dt>
                  <dd>
                    {r.customer ? (
                      <Link href={`/customers/${r.customer.id}`} className="text-blue-600 hover:underline" onClick={onClose}>
                        {r.customer.name}
                      </Link>
                    ) : '\u2014'}
                  </dd>

                  <dt className="text-slate-400">Sales Order</dt>
                  <dd>
                    {r.sales_order ? (
                      <span>
                        <Link href={`/orders/${r.sales_order.id}`} className="text-blue-600 hover:underline font-mono text-xs" onClick={onClose}>
                          {r.sales_order.so_number}
                        </Link>
                        <span className="text-slate-400 ml-1.5 text-xs">{formatDate(r.sales_order.order_date)}</span>
                      </span>
                    ) : '\u2014'}
                  </dd>

                  <dt className="text-slate-400">Install Date</dt>
                  <dd>
                    {r.job ? (
                      <span>
                        <Link href={`/scheduling/jobs/${r.job.id}`} className="text-blue-600 hover:underline" onClick={onClose}>
                          {r.job.completed_at ? formatDate(r.job.completed_at) : r.job.scheduled_date ? formatDate(r.job.scheduled_date) : 'Scheduled'}
                        </Link>
                        {!r.job.completed_at && r.job.scheduled_date && (
                          <span className="text-slate-400 ml-1 text-xs">(scheduled)</span>
                        )}
                      </span>
                    ) : '\u2014'}
                  </dd>

                  <dt className="text-slate-400">PO Number</dt>
                  <dd className="font-mono text-xs">{r.po_number || '\u2014'}</dd>

                  <dt className="text-slate-400">Delivery Note</dt>
                  <dd>
                    {r.delivery_note ? (
                      <span>
                        <span className="font-mono text-xs">{r.delivery_note.dn_number}</span>
                        {r.delivery_note.dispatched_at && (
                          <span className="text-slate-400 ml-1.5 text-xs">{formatDate(r.delivery_note.dispatched_at)}</span>
                        )}
                      </span>
                    ) : '\u2014'}
                  </dd>
                </dl>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
