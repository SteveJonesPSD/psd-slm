import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { CustomerHeader } from './customer-header'
import { ContactsSection } from './contacts-section'
import { OpportunitiesSection } from './opportunities-section'
import { QuotesSection } from './quotes-section'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch customer and related data
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('customer_id', id)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('first_name')

  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*, users!opportunities_assigned_to_fkey(id, first_name, last_name, initials, color)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  const { data: quotes } = await supabase
    .from('quotes')
    .select(`
      *,
      users!quotes_assigned_to_fkey(id, first_name, last_name, initials, color),
      quote_lines(quantity, sell_price)
    `)
    .eq('customer_id', id)
    .not('status', 'eq', 'revised')
    .order('created_at', { ascending: false })

  if (!customer) notFound()

  const opps = opportunities || []
  const activeOpps = opps.filter((o: { stage: string }) => !['lost'].includes(o.stage))
  const pipelineValue = activeOpps.reduce(
    (s: number, o: { estimated_value: number | null }) => s + (o.estimated_value || 0),
    0
  )
  const quoteCount = (quotes || []).length

  return (
    <div>
      {/* Back link */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; Customers
      </Link>

      {/* Customer header with edit */}
      <CustomerHeader customer={customer} />

      {/* Stats row */}
      <div className="flex flex-wrap gap-4 mb-6">
        <StatCard label="Contacts" value={contacts?.length || 0} />
        <StatCard
          label="Opportunities"
          value={activeOpps.length}
          sub={`${formatCurrency(pipelineValue)} pipeline`}
          accent="#6366f1"
        />
        <StatCard
          label="Quotes"
          value={quoteCount}
          accent="#d97706"
        />
        <StatCard
          label="Payment Terms"
          value={`${customer.payment_terms} days`}
          accent="#059669"
        />
      </div>

      {/* Customer info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5">
        <h3 className="text-[15px] font-semibold mb-3">Customer Details</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Account Number" value={customer.account_number} />
          <DetailField label="Phone" value={customer.phone} />
          <DetailField label="Email" value={customer.email} />
          <DetailField label="Website" value={customer.website} />
          <DetailField label="VAT Number" value={customer.vat_number} />
          <DetailField label="Payment Terms" value={customer.payment_terms ? `${customer.payment_terms} days` : null} />
          {customer.dfe_number && (
            <DetailField label="DfE Number" value={customer.dfe_number} />
          )}
          <DetailField
            label="Address"
            value={[customer.address_line1, customer.address_line2, customer.city, customer.county, customer.postcode]
              .filter(Boolean)
              .join(', ')}
            className="col-span-2 lg:col-span-3"
          />
          {customer.notes && (
            <DetailField label="Notes" value={customer.notes} className="col-span-2 lg:col-span-3" />
          )}
        </div>
      </div>

      {/* Contacts */}
      <ContactsSection contacts={contacts || []} customerId={id} />

      {/* Opportunities */}
      <OpportunitiesSection opportunities={opps} customerId={id} />

      {/* Quotes */}
      <QuotesSection quotes={quotes || []} />
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
