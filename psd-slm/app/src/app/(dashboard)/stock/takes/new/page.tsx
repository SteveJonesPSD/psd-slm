'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SearchableSelect } from '@/components/ui/form-fields'
import { createStockTake, getStockLocations } from '../../actions'
import type { StockLocation } from '@/types/database'

export default function NewStockTakePage() {
  const router = useRouter()
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [locationId, setLocationId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStockLocations().then(locs => {
      setLocations(locs)
      const defaultLoc = locs.find(l => l.is_default)
      if (defaultLoc) setLocationId(defaultLoc.id)
      else if (locs.length > 0) setLocationId(locs[0].id)
    })
  }, [])

  const handleCreate = async () => {
    if (!locationId) return
    setLoading(true)
    setError(null)

    const result = await createStockTake({ locationId })
    if ('error' in result) {
      setError(result.error as string)
      setLoading(false)
    } else {
      router.push(`/stock/takes/${result.id}`)
    }
  }

  return (
    <div>
      <PageHeader
        title="New Stock Take"
        subtitle="Create a stock count for reconciliation"
      />

      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <div>
          <SearchableSelect
            label="Location"
            value={locationId}
            options={locations.map(loc => ({ value: loc.id, label: `${loc.name} (${loc.code})` }))}
            placeholder="Search locations..."
            onChange={setLocationId}
          />
          <p className="mt-1 text-xs text-slate-400">
            All stocked products at this location will be included.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex items-center gap-3 justify-end">
          <Link
            href="/stock/takes"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50"
          >
            Cancel
          </Link>
          <Button
            onClick={handleCreate}
            variant="primary"
            disabled={loading || !locationId}
          >
            {loading ? 'Creating...' : 'Start Stock Take'}
          </Button>
        </div>
      </div>
    </div>
  )
}
