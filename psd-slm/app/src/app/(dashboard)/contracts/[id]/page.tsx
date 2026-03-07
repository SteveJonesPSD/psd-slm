import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { requireAuth, hasPermission } from '@/lib/auth'
import { Badge, CONTRACT_STATUS_CONFIG, CONTRACT_CATEGORY_CONFIG, RENEWAL_PERIOD_CONFIG } from '@/components/ui/badge'
import { getCustomerContract, getFieldEngineers } from '../actions'
import { ContractActions } from './contract-actions'
import { ContractLinesSection } from './contract-lines-section'
import { ContractEntitlementsSection } from './contract-entitlements-section'
import { VisitScheduleSection } from './visit-schedule-section'
import { RenewalHistorySection } from './renewal-history-section'
import { VisitOverridesSection } from './visit-overrides-section'
import { ContractNotesSection } from './contract-notes-section'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatFrequency(f: string | null): string {
  if (!f) return '\u2014'
  return f.charAt(0).toUpperCase() + f.slice(1)
}

export default async function ContractDetailPage({ params }: PageProps) {
  const { id } = await params
  const [user, contract, engineers] = await Promise.all([
    requireAuth(),
    getCustomerContract(id),
    getFieldEngineers(),
  ])

  if (!contract) notFound()

  const canEdit = hasPermission(user, 'contracts', 'edit')
  const statusCfg = CONTRACT_STATUS_CONFIG[contract.status]
  const catCfg = CONTRACT_CATEGORY_CONFIG[contract.category]
  const renewalCfg = RENEWAL_PERIOD_CONFIG[contract.renewal_period]
  const isEditable = ['draft', 'active'].includes(contract.status) && canEdit

  return (
    <div>
      {/* Back link */}
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6"
      >
        &larr; Contracts
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-10">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{contract.contract_number}</h1>
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              v{contract.version}
            </span>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            {catCfg && <Badge label={catCfg.label} color={catCfg.color} bg={catCfg.bg} />}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            <Link href={`/customers/${contract.customer_id}`} className="text-indigo-600 hover:text-indigo-800 no-underline">
              {contract.customer_name}
            </Link>
            {' \u2014 '}{contract.contract_type_name}
          </div>
        </div>

        {canEdit && <ContractActions contract={contract} />}
      </div>

      {/* Info panel */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <h3 className="text-[15px] font-semibold mb-4">Contract Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Contract Type" value={contract.contract_type_name} />
          <DetailField label="Category" value={catCfg?.label || contract.category} />
          <DetailField label="Contact" value={contract.contact_name} />
          <DetailField label="Start Date" value={new Date(contract.start_date).toLocaleDateString('en-GB')} />
          <DetailField label="End Date" value={new Date(contract.end_date).toLocaleDateString('en-GB')} />
          <DetailField
            label="Renewal Period"
            value={
              renewalCfg ? (
                <Badge label={renewalCfg.label} color={renewalCfg.color} bg={renewalCfg.bg} />
              ) : contract.renewal_period
            }
          />
          <DetailField label="Auto Renew" value={contract.auto_renew ? 'Yes' : 'No'} />
          <DetailField
            label="Annual Value"
            value={contract.annual_value ? formatCurrency(Number(contract.annual_value)) : '\u2014'}
          />
          <DetailField
            label="Billing Frequency"
            value={contract.billing_frequency ? contract.billing_frequency.charAt(0).toUpperCase() + contract.billing_frequency.slice(1) : '\u2014'}
          />
          {contract.opportunity_id && (
            <DetailField
              label="Opportunity"
              value={
                <Link href={`/opportunities/${contract.opportunity_id}`} className="text-indigo-600 hover:text-indigo-800 no-underline">
                  View Opportunity
                </Link>
              }
            />
          )}
          {contract.quote_id && (
            <DetailField
              label="Quote"
              value={
                <Link href={`/quotes/${contract.quote_id}`} className="text-indigo-600 hover:text-indigo-800 no-underline">
                  View Quote
                </Link>
              }
            />
          )}
          {contract.effective_sla_plan_name && (
            <DetailField label="SLA Plan" value={contract.effective_sla_plan_name} />
          )}
          {contract.effective_monthly_hours && (
            <DetailField label="Monthly Hours" value={`${contract.effective_monthly_hours}h`} />
          )}
          {contract.calendar_name && (
            <DetailField
              label="Visit Calendar"
              value={`${contract.calendar_name} (${contract.calendar_schedule_weeks}-week)`}
            />
          )}
          {contract.last_signed_at && (
            <>
              <DetailField label="Last Signed" value={new Date(contract.last_signed_at).toLocaleDateString('en-GB')} />
              <DetailField label="Signed By" value={contract.signed_by_name} />
            </>
          )}
        </div>
      </div>

      {/* Visit Overrides */}
      <VisitOverridesSection contract={contract} editable={isEditable} />

      {/* Contract Lines */}
      <ContractLinesSection
        contractId={id}
        lines={contract.lines || []}
        editable={isEditable}
      />

      {/* Entitlements */}
      <ContractEntitlementsSection
        contractId={id}
        entitlements={contract.entitlements || []}
        includesRemote={contract.includes_remote_support}
        includesTelephone={contract.includes_telephone}
        includesOnsite={contract.includes_onsite}
        editable={isEditable}
      />

      {/* Visit Schedule */}
      <VisitScheduleSection
        contractId={id}
        slots={contract.visit_slots || []}
        engineers={engineers}
        contractTypeCode={contract.contract_type_code}
        visitFrequency={contract.effective_frequency || null}
        scheduleWeeks={contract.calendar_schedule_weeks}
        editable={isEditable}
      />

      {/* Renewal History */}
      {(contract.version > 1 || (contract.renewals && contract.renewals.length > 0)) && (
        <RenewalHistorySection renewals={contract.renewals || []} currentContractId={id} />
      )}

      {/* Notes */}
      <ContractNotesSection contractId={id} notes={contract.notes} editable={isEditable} />
    </div>
  )
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="text-slate-700">{value || '\u2014'}</div>
    </div>
  )
}
