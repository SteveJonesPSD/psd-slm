import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalContracts } from '@/lib/portal/contracts-actions'
import { formatDate } from '@/lib/utils'

export default async function PortalContractsPage() {
  const ctx = await requirePortalSession()
  const contracts = await getPortalContracts(ctx)

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">Your Contracts</h1>
        <p className="mt-1 text-sm text-slate-500">View your active service contracts and entitlements</p>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          No contracts to display
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/portal/contracts/${c.id}`}
              className="block rounded-xl border border-slate-200 bg-white px-5 py-4 hover:shadow-sm transition-shadow no-underline"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{c.contractType}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span>Start: {formatDate(c.startDate)}</span>
                    {c.renewalDate && <span>Renewal: {formatDate(c.renewalDate)}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
