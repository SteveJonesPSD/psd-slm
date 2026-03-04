import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCollection } from '@/lib/collections/actions'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { CollectionDetailActions } from './collection-detail-actions'
import { GpsMapPopout } from './gps-map-popout'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  collected: { label: 'Collected', color: '#059669', bg: '#ecfdf5' },
  partial: { label: 'Partial', color: '#2563eb', bg: '#eff6ff' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6' },
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CollectionDetailPage({ params }: PageProps) {
  const { id } = await params
  const collection = await getCollection(id)

  if (!collection) notFound()

  const job = collection.jobs as { id: string; job_number: string; title: string } | undefined
  const so = collection.sales_orders as { id: string; so_number: string; customer_id?: string; customers?: { id: string; name: string } | null } | undefined
  const preparedBy = collection.prepared_by_user
  const collectedBy = collection.collected_by_user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLines = (collection.job_collection_lines || []) as any[]
  const lines = rawLines.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  const statusBadge = STATUS_BADGE[collection.status] || STATUS_BADGE.pending

  const hasGps = collection.collection_latitude != null && collection.collection_longitude != null
  const isConfirmed = collection.status === 'collected' || collection.status === 'partial'

  // Resolve who collected — either a linked user or the engineer who signed
  const collectedByName = collectedBy
    ? `${collectedBy.first_name} ${collectedBy.last_name}`
    : collection.engineer_name || null

  return (
    <div>
      <div className="mb-6">
        <Link href="/collections" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Collections
        </Link>
      </div>

      <PageHeader
        title={collection.slip_number}
        subtitle={`${so?.customers?.name || 'Unknown Customer'} · ${job?.job_number || 'No Job'}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge label={statusBadge.label} color={statusBadge.color} bg={statusBadge.bg} />
            <CollectionDetailActions collection={collection} />
          </div>
        }
      />

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {/* Job */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Job</div>
          {job ? (
            <Link href={`/scheduling/jobs/${job.id}`} className="text-sm font-semibold text-indigo-600 hover:underline">
              {job.job_number}
            </Link>
          ) : (
            <span className="text-sm text-slate-500">—</span>
          )}
          {job?.title && <div className="text-xs text-slate-500 mt-0.5">{job.title}</div>}
        </div>

        {/* SO */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Sales Order</div>
          {so ? (
            <Link href={`/orders/${so.id}`} className="text-sm font-semibold text-indigo-600 hover:underline">
              {so.so_number}
            </Link>
          ) : (
            <span className="text-sm text-slate-500">—</span>
          )}
        </div>

        {/* Prepared by */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Prepared By</div>
          {preparedBy ? (
            <div className="flex items-center gap-2">
              <Avatar user={preparedBy} size={24} />
              <span className="text-sm text-slate-700">{preparedBy.first_name} {preparedBy.last_name}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-500">—</span>
          )}
          {collection.prepared_at && (
            <div className="text-xs text-slate-400 mt-1">
              {new Date(collection.prepared_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* Collected by */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Collected By</div>
          {collectedBy ? (
            <div className="flex items-center gap-2">
              <Avatar user={collectedBy} size={24} />
              <span className="text-sm text-slate-700">{collectedBy.first_name} {collectedBy.last_name}</span>
            </div>
          ) : collection.engineer_name ? (
            <div className="flex items-center gap-2">
              {/* Initials circle for engineer who signed via magic link */}
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold"
                style={{ width: 24, height: 24 }}
              >
                {collection.engineer_initials || collection.engineer_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <span className="text-sm text-slate-700">{collection.engineer_name}</span>
              {hasGps && (
                <GpsMapPopout
                  latitude={collection.collection_latitude!}
                  longitude={collection.collection_longitude!}
                  accuracy={collection.collection_accuracy}
                  engineerInitials={collection.engineer_initials}
                />
              )}
            </div>
          ) : (
            <span className="text-sm text-amber-600 font-medium">Pending collection</span>
          )}
          {collection.collected_at && (
            <div className="text-xs text-slate-400 mt-1">
              {new Date(collection.collected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {collection.notes && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-1">Notes</div>
          <div className="text-sm text-amber-800">{collection.notes}</div>
        </div>
      )}

      {/* Lines table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-slate-700">Collection Items ({lines.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[700px]">
            <thead>
              <tr>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Product</th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expected</th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Confirmed</th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expected Serials</th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Confirmed Serials</th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: { id: string; description: string; quantity_expected: number; quantity_confirmed: number; is_confirmed: boolean; confirmed_at: string | null; expected_serials: string[] | null; confirmed_serials: string[] | null; notes: string | null; products?: { sku: string; name: string } | null }) => {
                const product = line.products
                const isPartialCollection = collection.status === 'partial'
                const bgClass = line.is_confirmed
                  ? 'bg-green-50/50'
                  : isPartialCollection
                  ? 'bg-amber-50/50'
                  : ''

                return (
                  <tr key={line.id} className={`border-b border-slate-100 ${bgClass}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{line.description}</div>
                      {product?.sku && (
                        <div className="text-xs text-slate-400">{product.sku}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center font-medium whitespace-nowrap">{line.quantity_expected}</td>
                    <td className="px-5 py-3 text-center font-medium whitespace-nowrap">{line.quantity_confirmed}</td>
                    <td className="px-5 py-3">
                      {line.expected_serials?.length ? (
                        <div className="space-y-0.5">
                          {line.expected_serials.map((s, i) => (
                            <div key={i} className="text-xs font-mono text-slate-500">{s}</div>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {line.confirmed_serials?.length ? (
                        <div className="space-y-0.5">
                          {line.confirmed_serials.map((s, i) => (
                            <div key={i} className="text-xs font-mono text-green-700">{s}</div>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      {line.is_confirmed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Confirmed
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{line.notes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
