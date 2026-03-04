import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { Badge, DN_STATUS_CONFIG } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { getDeliveryNote } from '../actions'
import { DnDetailActions } from './dn-detail-actions'
import type { User } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DeliveryNoteDetailPage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('delivery_notes', 'view')

  const dn = await getDeliveryNote(id)
  if (!dn) notFound()

  const statusCfg = DN_STATUS_CONFIG[dn.status]
  const so = dn.salesOrder as { id: string; so_number: string; customer_id: string; customers: { id: string; name: string } | null } | null
  const customer = so?.customers
  const creator = dn.creator as { first_name: string; last_name: string } | null

  const address = [dn.delivery_address_line1, dn.delivery_address_line2, dn.delivery_city, dn.delivery_postcode]
    .filter(Boolean)
    .join(', ')

  return (
    <div>
      <Link
        href="/delivery-notes"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; All Delivery Notes
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{dn.dn_number}</h2>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
          </div>
          <div className="flex items-center gap-4 flex-wrap gap-y-1 text-sm text-slate-500">
            {so && (
              <Link href={`/orders/${so.id}`} className="text-blue-600 hover:underline no-underline">
                {so.so_number}
              </Link>
            )}
            {customer && (
              <Link href={`/customers/${customer.id}`} className="hover:text-slate-700 no-underline">
                {customer.name}
              </Link>
            )}
            {creator && <span>Created by {creator.first_name} {creator.last_name}</span>}
            <span>{formatDate(dn.created_at)}</span>
          </div>
        </div>

        <DnDetailActions dnId={dn.id} status={dn.status} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        {/* Delivery Address */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">Delivery Address</h3>
          <p className="text-sm text-slate-700">{address || 'No address set'}</p>
        </div>

        {/* Carrier & Tracking */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-[15px] font-semibold mb-4">Shipping</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase">Carrier</span>
              <div className="text-slate-700">{dn.carrier || '\u2014'}</div>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase">Tracking</span>
              <div className="text-slate-700 font-mono text-xs">{dn.tracking_reference || '\u2014'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <div className="text-xs text-slate-400 uppercase mb-1">Created</div>
          <div className="text-sm font-medium">{formatDate(dn.created_at)}</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <div className="text-xs text-blue-400 uppercase mb-1">Confirmed</div>
          <div className="text-sm font-medium">{dn.confirmed_at ? formatDate(dn.confirmed_at) : '\u2014'}</div>
        </div>
        <div className="rounded-lg bg-indigo-50 p-3 text-center">
          <div className="text-xs text-indigo-400 uppercase mb-1">Dispatched</div>
          <div className="text-sm font-medium">{dn.dispatched_at ? formatDate(dn.dispatched_at) : '\u2014'}</div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3 text-center">
          <div className="text-xs text-emerald-400 uppercase mb-1">Delivered</div>
          <div className="text-sm font-medium">{dn.delivered_at ? formatDate(dn.delivered_at) : '\u2014'}</div>
        </div>
      </div>

      {/* Notes */}
      {dn.notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 mb-6">
          <h3 className="text-[13px] font-semibold text-amber-800 mb-2">Notes</h3>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{dn.notes}</p>
        </div>
      )}

      {/* Lines */}
      <div className="rounded-xl border border-gray-200 bg-white mb-6">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold">Lines</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-t border-b border-gray-100 text-xs font-medium uppercase text-slate-400">
                <th className="px-5 py-2.5 text-left">Description</th>
                <th className="px-5 py-2.5 text-left">SKU</th>
                <th className="px-5 py-2.5 text-right">Qty</th>
                <th className="px-5 py-2.5 text-left">Serial Numbers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dn.lines.map((line: Record<string, unknown>) => {
                const prod = Array.isArray(line.products) ? line.products[0] : line.products
                return (
                <tr key={line.id as string}>
                  <td className="px-5 py-2.5 font-medium">{line.description as string}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-400">
                    {(prod as { sku: string } | null)?.sku || '\u2014'}
                  </td>
                  <td className="px-5 py-2.5 text-right">{line.quantity as number}</td>
                  <td className="px-5 py-2.5">
                    {(line.serial_numbers as string[] | null)?.length ? (
                      <span className="text-xs font-mono text-slate-500">
                        {(line.serial_numbers as string[]).join(', ')}
                      </span>
                    ) : '\u2014'}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity */}
      {dn.activities.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-[15px] font-semibold">Activity</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {dn.activities.map((a: { id: string; action: string; details: Record<string, unknown> | null; created_at: string; users: { first_name: string; last_name: string; initials: string | null; color: string | null } | null }) => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className="text-xs text-slate-400 whitespace-nowrap mt-0.5">
                  {formatDate(a.created_at)}
                </div>
                <div className="text-sm text-slate-600">
                  {a.users && (
                    <span className="font-medium">{a.users.first_name} {a.users.last_name}</span>
                  )}
                  {' '}{a.action.replace(/^dn\./, '').replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
