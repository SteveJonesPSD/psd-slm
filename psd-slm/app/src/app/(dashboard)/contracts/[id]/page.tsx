import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { requireAuth, hasPermission } from '@/lib/auth'
import { Badge, CONTRACT_STATUS_CONFIG, CONTRACT_CATEGORY_CONFIG, RENEWAL_PERIOD_CONFIG } from '@/components/ui/badge'
import { getCustomerContract, getFieldEngineers, getInvoiceSchedule, getLicensingRenewalState } from '../actions'
import type { CustomerContractWithDetails } from '@/lib/contracts/types'
import { ContractActions } from './contract-actions'
import { EsignBanner } from './esign-banner'
import { ContractLinesSection } from './contract-lines-section'
import { InvoiceScheduleSection } from './invoice-schedule-section'
import { UpgradeSection } from './upgrade-section'
import { RenewalFlowSection } from './renewal-flow-section'
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
  const [user, contract, engineers, invoiceSchedule, renewalState] = await Promise.all([
    requireAuth(),
    getCustomerContract(id),
    getFieldEngineers(),
    getInvoiceSchedule(id),
    getLicensingRenewalState(id),
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

      {/* E-Sign Banner (service/licensing only) */}
      {['service', 'licensing'].includes(contract.category) && contract.esign_status !== 'not_required' && (
        <EsignBanner
          contractId={contract.id}
          contractNumber={contract.contract_number}
          esignStatus={contract.esign_status}
          isAdmin={['admin', 'super_admin'].includes(user.role.name)}
        />
      )}

      {/* Days Remaining / Rolling Card (service/licensing with end_date) */}
      {['service', 'licensing'].includes(contract.category) && (
        <DaysRemainingCard contract={contract} />
      )}

      {/* Contextual Status Banner */}
      {['service', 'licensing'].includes(contract.category) && contract.esign_status !== 'pending' && (
        <ContractStatusBanner contract={contract} />
      )}

      {/* Info panel */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <h3 className="text-[15px] font-semibold mb-4">Contract Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Contract Type" value={contract.contract_type_name} />
          <DetailField label="Category" value={catCfg?.label || contract.category} />
          <DetailField label="Contact" value={contract.contact_name} />
          <DetailField label="Start Date" value={new Date(contract.start_date).toLocaleDateString('en-GB')} />
          <DetailField label="End Date" value={contract.end_date ? new Date(contract.end_date).toLocaleDateString('en-GB') : 'Open-ended'} />
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
          {contract.go_live_date && (
            <DetailField label="Go-Live Date" value={new Date(contract.go_live_date).toLocaleDateString('en-GB')} />
          )}
          {contract.term_months && (
            <DetailField label="Term" value={`${contract.term_months} months`} />
          )}
          {contract.is_rolling && (
            <DetailField label="Rolling" value={`Yes (${contract.rolling_frequency || 'monthly'})`} />
          )}
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
          {(contract.quote_id || contract.source_quote_id) && (
            <DetailField
              label="Quote"
              value={
                <Link href={`/quotes/${contract.source_quote_id || contract.quote_id}`} className="text-indigo-600 hover:text-indigo-800 no-underline">
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

      {/* Invoice Schedule (all contract categories) */}
      <InvoiceScheduleSection
        contractId={id}
        schedule={invoiceSchedule}
        editable={isEditable}
      />

      {/* Upgrade Section (service contracts only, active/rolling) */}
      {contract.category === 'service' && ['active', 'alert_180', 'alert_90', 'rolling'].includes(contract.renewal_status) && canEdit && (
        <UpgradeSection contractId={id} contractNumber={contract.contract_number} />
      )}

      {/* Licensing Renewal Section */}
      {contract.category === 'licensing' && canEdit && (
        <RenewalFlowSection
          contractId={id}
          contractNumber={contract.contract_number}
          daysRemaining={contract.end_date
            ? Math.floor((new Date(contract.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null}
          isOpenEnded={!contract.end_date}
          renewalState={renewalState}
        />
      )}

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

function DaysRemainingCard({ contract }: { contract: CustomerContractWithDetails }) {
  if (contract.is_rolling) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 mb-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-1">Rolling Contract</div>
        <div className="text-lg font-bold text-indigo-700">
          {contract.rolling_frequency === 'annual' ? 'Annual' : 'Monthly'} billing
        </div>
        {contract.next_invoice_date && (
          <div className="text-sm text-indigo-600 mt-1">
            Next invoice: {new Date(contract.next_invoice_date).toLocaleDateString('en-GB')}
          </div>
        )}
      </div>
    )
  }

  if (!contract.end_date) return null

  const days = Math.floor((new Date(contract.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const isExpired = days < 0

  let cardClasses: string
  if (isExpired) {
    cardClasses = 'border-red-200 bg-red-50'
  } else if (days <= 90) {
    cardClasses = 'border-red-200 bg-red-50'
  } else if (days <= 180) {
    cardClasses = 'border-amber-200 bg-amber-50'
  } else {
    cardClasses = 'border-green-200 bg-green-50'
  }

  const textColor = isExpired || days <= 90 ? 'text-red-700' : days <= 180 ? 'text-amber-700' : 'text-green-700'
  const labelColor = isExpired || days <= 90 ? 'text-red-500' : days <= 180 ? 'text-amber-500' : 'text-green-500'

  return (
    <div className={`rounded-xl border ${cardClasses} p-5 mb-8`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${labelColor} mb-1`}>
        {isExpired ? 'Contract Expired' : 'Contract Expires In'}
      </div>
      <div className={`text-2xl font-bold ${textColor}`}>
        {isExpired ? `${Math.abs(days)} days ago` : `${days} days`}
      </div>
      <div className={`text-sm ${textColor} mt-1`}>
        {new Date(contract.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  )
}

function ContractStatusBanner({ contract }: { contract: CustomerContractWithDetails }) {
  if (!contract.renewal_status || contract.renewal_status === 'active') return null

  const days = contract.end_date
    ? Math.floor((new Date(contract.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const banners: Record<string, { border: string; bg: string; text: string; message: string } | null> = {
    alert_90: {
      border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800',
      message: `Contract expires in ${days} days — action required`,
    },
    alert_180: {
      border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800',
      message: `Contract expires in ${days} days — consider initiating renewal`,
    },
    rolling: {
      border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-800',
      message: `Rolling ${contract.rolling_frequency || 'monthly'} billing — contract continues until cancelled`,
    },
    expired: {
      border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800',
      message: `This contract expired on ${contract.end_date ? new Date(contract.end_date).toLocaleDateString('en-GB') : 'unknown date'}`,
    },
    superseded: {
      border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-600',
      message: `This contract was superseded${contract.upgrade_go_live_date ? ` on ${new Date(contract.upgrade_go_live_date).toLocaleDateString('en-GB')}` : ''}`,
    },
  }

  const cfg = banners[contract.renewal_status]
  if (!cfg) return null

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-4 py-3 mb-8`}>
      <span className={`text-sm font-medium ${cfg.text}`}>{cfg.message}</span>
    </div>
  )
}
