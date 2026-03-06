import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalContractDetail } from '@/lib/portal/contracts-actions'
import { formatDate } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PortalContractDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await requirePortalSession()
  const data = await getPortalContractDetail(id, ctx)

  if (!data) notFound()

  const { contract, visitSlots } = data

  return (
    <div>
      <Link href="/portal/contracts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6">
        &larr; Contracts
      </Link>

      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">{contract.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>{contract.contractType}</span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${
            contract.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {contract.status}
          </span>
          <span>Start: {formatDate(contract.startDate)}</span>
          {contract.endDate && <span>End: {formatDate(contract.endDate)}</span>}
          {contract.renewalDate && <span>Renewal: {formatDate(contract.renewalDate)}</span>}
        </div>
      </div>

      {/* Visit Schedule */}
      {visitSlots.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Visit Schedule</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Day</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Frequency</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Time Window</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visitSlots.map((s, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 text-slate-700">{s.dayOfWeek}</td>
                  <td className="px-5 py-3 text-slate-600">{s.frequency}</td>
                  <td className="px-5 py-3 text-slate-600">{s.timeWindow}</td>
                  <td className="px-5 py-3 text-slate-500">{s.portalNotes || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visitSlots.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          No visit schedule configured for this contract
        </div>
      )}
    </div>
  )
}
