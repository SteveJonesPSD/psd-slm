import { PageHeader } from '@/components/ui/page-header'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getContract } from '../../actions'
import { Badge } from '@/components/ui/badge'
import { CONTRACT_TYPE_CONFIG } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getContract(id)

  if (result.error || !result.data) return notFound()

  const contract = result.data
  const typeConfig = CONTRACT_TYPE_CONFIG[contract.contract_type]
  const hoursUsed = contract.time_used_this_month ? Math.round(contract.time_used_this_month / 60 * 10) / 10 : 0
  const hoursLimit = contract.monthly_hours || 0
  const usagePct = hoursLimit > 0 ? Math.min((hoursUsed / hoursLimit) * 100, 100) : 0

  return (
    <div>
      <PageHeader
        title={contract.name}
        subtitle={contract.customers?.name}
        actions={
          <Link
            href="/helpdesk/contracts"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50 no-underline"
          >
            Back to Contracts
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Contract details */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Contract Details</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-slate-400">Customer</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{contract.customers?.name}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Type</dt>
              <dd className="mt-0.5">
                {typeConfig && <Badge label={typeConfig.label} color={typeConfig.color} bg={typeConfig.bg} />}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">SLA Plan</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{contract.sla_plans?.name || 'None'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Monthly Hours</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{contract.monthly_hours ? `${contract.monthly_hours}h` : 'Unlimited'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Start Date</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{new Date(contract.start_date).toLocaleDateString('en-GB')}</dd>
            </div>
            <div>
              <dt className="text-slate-400">End Date</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{contract.end_date ? new Date(contract.end_date).toLocaleDateString('en-GB') : 'Ongoing'}</dd>
            </div>
            {contract.onsite_engineer && (
              <div>
                <dt className="text-slate-400">Onsite Engineer</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{contract.onsite_engineer}</dd>
              </div>
            )}
            {contract.onsite_schedule && (
              <div>
                <dt className="text-slate-400">Schedule</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{contract.onsite_schedule}</dd>
              </div>
            )}
          </dl>
          {contract.notes && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-slate-600">
              {contract.notes}
            </div>
          )}
        </div>

        {/* Time usage */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Time Usage (This Month)</h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-900">{hoursUsed}h</div>
            {hoursLimit > 0 && (
              <>
                <div className="mt-1 text-sm text-slate-400">of {hoursLimit}h</div>
                <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${usagePct}%`,
                      backgroundColor: usagePct > 90 ? '#dc2626' : usagePct > 75 ? '#d97706' : '#059669',
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-400">{Math.round(usagePct)}% used</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent tickets */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Recent Tickets</h3>
        {contract.recent_tickets.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left font-medium text-slate-500">Ticket</th>
                <th className="pb-2 text-left font-medium text-slate-500">Subject</th>
                <th className="pb-2 text-left font-medium text-slate-500">Priority</th>
                <th className="pb-2 text-left font-medium text-slate-500">Status</th>
                <th className="pb-2 text-left font-medium text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {contract.recent_tickets.map((t: { id: string; ticket_number: string; subject: string; status: string; priority: string; created_at: string }) => {
                const statusCfg = TICKET_STATUS_CONFIG[t.status]
                const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority]
                return (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="py-2">
                      <Link href={`/helpdesk/tickets/${t.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 no-underline">
                        {t.ticket_number}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-700">{t.subject}</td>
                    <td className="py-2">
                      {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                    </td>
                    <td className="py-2">
                      {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                    </td>
                    <td className="py-2 text-slate-500">{new Date(t.created_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">No tickets for this contract yet.</p>
        )}
      </div>
    </div>
  )
}
