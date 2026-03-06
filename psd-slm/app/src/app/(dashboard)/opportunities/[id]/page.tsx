import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { StatCard } from '@/components/ui/stat-card'
import { Badge, QUOTE_STATUS_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { OPPORTUNITY_STAGE_CONFIG, type OpportunityStage } from '@/lib/opportunities'
import { OpportunityActions } from './opportunity-actions'
import { NotesEditor } from './notes-editor'
import { ActivityTimeline } from './activity-timeline'
import { NewQuoteButton } from './new-quote-button'
import type { User } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OpportunityDetailPage({ params }: PageProps) {
  const { id } = await params
  const user = await requirePermission('pipeline', 'view')
  const supabase = await createClient()

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single()

  if (!opportunity) notFound()

  // Fetch related data in parallel
  const [
    { data: customer },
    { data: contact },
    { data: assignedUser },
    { data: quotes },
    { data: activities },
  ] = await Promise.all([
    supabase.from('customers').select('id, name').eq('id', opportunity.customer_id).single(),
    opportunity.contact_id
      ? supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone')
          .eq('id', opportunity.contact_id)
          .single()
      : Promise.resolve({ data: null }),
    opportunity.assigned_to
      ? supabase
          .from('users')
          .select('id, first_name, last_name, initials, color')
          .eq('id', opportunity.assigned_to)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('quotes')
      .select('id, quote_number, title, status, created_at, users!quotes_assigned_to_fkey(first_name, last_name), quote_lines(quantity, sell_price)')
      .eq('opportunity_id', id)
      .not('status', 'eq', 'revised')
      .order('created_at', { ascending: false }),
    supabase
      .from('activity_log')
      .select('*, users:user_id(first_name, last_name, initials, color)')
      .eq('entity_type', 'opportunity')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const stageCfg = OPPORTUNITY_STAGE_CONFIG[opportunity.stage as OpportunityStage]
  const weightedValue = (opportunity.estimated_value || 0) * (opportunity.probability / 100)
  const daysOpen = Math.ceil(
    (Date.now() - new Date(opportunity.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Close date color
  let closeDateColor = '#1e293b'
  if (opportunity.expected_close_date) {
    const daysAway = Math.ceil(
      (new Date(opportunity.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysAway < 0) closeDateColor = '#dc2626'
    else if (daysAway <= 30) closeDateColor = '#d97706'
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6"
      >
        &larr; Pipeline
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{opportunity.title}</h2>
            {stageCfg && (
              <Badge label={stageCfg.label} color={stageCfg.color} bg={stageCfg.bg} />
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {customer && (
              <Link href={`/customers/${customer.id}`} className="hover:text-slate-700 no-underline">
                {customer.name}
              </Link>
            )}
            {contact && (
              <span>
                {contact.first_name} {contact.last_name}
              </span>
            )}
            {assignedUser && (
              <span className="flex items-center gap-1.5">
                <Avatar user={assignedUser as User} size={20} />
                {assignedUser.first_name} {assignedUser.last_name}
              </span>
            )}
          </div>
        </div>

        <OpportunityActions opportunity={opportunity} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        <StatCard
          label="Estimated Value"
          value={formatCurrency(opportunity.estimated_value || 0)}
          accent="#6366f1"
        />
        <StatCard
          label="Probability"
          value={`${opportunity.probability}%`}
          accent="#0891b2"
        />
        <StatCard
          label="Weighted Value"
          value={formatCurrency(weightedValue)}
          accent="#059669"
        />
        <StatCard
          label="Close Date"
          value={opportunity.expected_close_date ? formatDate(opportunity.expected_close_date) : '\u2014'}
          accent={closeDateColor}
        />
        <StatCard
          label="Days Open"
          value={daysOpen}
          accent="#d97706"
        />
      </div>

      {/* Details card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <h3 className="text-[15px] font-semibold mb-4">Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Company" value={customer?.name} />
          <DetailField
            label="Contact"
            value={contact ? `${contact.first_name} ${contact.last_name}` : null}
          />
          <DetailField
            label="Assigned To"
            value={assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : null}
          />
          <DetailField label="Stage" value={stageCfg?.label} />
          <DetailField label="Probability" value={`${opportunity.probability}%`} />
          <DetailField
            label="Estimated Value"
            value={opportunity.estimated_value ? formatCurrency(opportunity.estimated_value) : null}
          />
          <DetailField
            label="Expected Close"
            value={opportunity.expected_close_date ? formatDate(opportunity.expected_close_date) : null}
          />
          <DetailField label="Created" value={formatDate(opportunity.created_at)} />
          {opportunity.lost_reason && (
            <DetailField label="Lost Reason" value={opportunity.lost_reason} className="col-span-2 lg:col-span-3" />
          )}
        </div>
      </div>

      {/* Notes */}
      <NotesEditor opportunityId={opportunity.id} initialNotes={opportunity.notes || ''} />

      {/* Quotes section */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold">
            Quotes ({quotes?.length || 0})
          </h3>
          <NewQuoteButton opportunityId={opportunity.id} customerId={opportunity.customer_id} />
        </div>
        {quotes && quotes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                    Quote #
                  </th>
                  <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                    Title
                  </th>
                  <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                    Status
                  </th>
                  <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                    Value
                  </th>
                  <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const lines = q.quote_lines as { quantity: number; sell_price: number }[]
                  const total = (lines || []).reduce((s, l) => s + l.quantity * l.sell_price, 0)
                  const qStatusCfg = QUOTE_STATUS_CONFIG[q.status as keyof typeof QUOTE_STATUS_CONFIG]
                  return (
                    <tr key={q.id} className="border-b border-slate-100">
                      <td className="px-5 py-3 font-medium whitespace-nowrap">
                        <Link href={`/quotes/${q.id}`} className="text-blue-600 hover:text-blue-800 no-underline">
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                        {q.title || '\u2014'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {qStatusCfg ? <Badge label={qStatusCfg.label} color={qStatusCfg.color} bg={qStatusCfg.bg} /> : q.status}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">{formatCurrency(total)}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{formatDate(q.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No quotes linked to this opportunity.</p>
        )}
      </div>

      {/* Activity timeline */}
      <ActivityTimeline activities={activities || []} />
    </div>
  )
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string
  value: string | number | null | undefined
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
