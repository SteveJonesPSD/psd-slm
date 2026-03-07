import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { decryptCustomerRow, decryptContactRows } from '@/lib/crypto-helpers'
import { formatCurrency } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { CustomerHeader } from './customer-header'
import { CollapsibleCard } from './collapsible-card'
import { ContactsSection } from './contacts-section'
import { OpportunitiesSection } from './opportunities-section'
import { QuotesSection } from './quotes-section'
import { SalesOrdersSection } from './sales-orders-section'
import { InvoicesSection } from './invoices-section'
import { ContractsSection } from './contracts-section'
import { SupportTicketsSection } from './support-tickets-section'
import { VisitSchedulingSection } from './visit-scheduling-section'
import { EmailDomainsSection } from './email-domains-section'
import { LinkedContactsSection } from './linked-contacts-section'
import { CustomerSearch } from './customer-search'
import { PortalAccessSection } from './portal-access-section'
import { GroupMembershipSection } from './group-membership-section'
import { getCompanyTickets } from '../../helpdesk/actions'
import { getContractsByCompany } from '../../contracts/actions'
import { getCompanyVisits } from '../../visit-scheduling/actions'
import { getCustomerDomains } from '../domain-actions'
import { getLinkedContacts } from '../link-actions'
import { deriveSoDisplayStatus } from '@/lib/sales-orders'
import { getEffectiveInvoiceStatus } from '@/lib/invoicing'
import { getUser, hasPermission } from '@/lib/auth'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch customer and related data
  const { data: rawCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  const customer = rawCustomer ? decryptCustomerRow(rawCustomer) : null

  const { data: rawContacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('customer_id', id)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('first_name')
  const contacts = rawContacts ? decryptContactRows(rawContacts) : null

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

  // Fetch contracts (may fail if module not deployed yet)
  let contractsData: Awaited<ReturnType<typeof getContractsByCompany>> = []
  try {
    contractsData = await getContractsByCompany(id)
  } catch {
    // Contracts module may not be deployed yet
  }

  // Fetch support tickets (may fail if helpdesk module not set up yet)
  let supportData: Awaited<ReturnType<typeof getCompanyTickets>> | null = null
  try {
    supportData = await getCompanyTickets(id)
  } catch {
    // Helpdesk module may not be deployed yet
  }

  // Fetch visit schedule data (may fail if module not deployed yet)
  let visitsData: Awaited<ReturnType<typeof getCompanyVisits>> = []
  try {
    visitsData = await getCompanyVisits(id)
  } catch {
    // Visit scheduling module may not be deployed yet
  }

  // Fetch email domains (may fail if migration not applied yet)
  let emailDomains: Awaited<ReturnType<typeof getCustomerDomains>> = []
  try {
    emailDomains = await getCustomerDomains(id)
  } catch {
    // Email domains migration may not be applied yet
  }

  // Fetch linked contacts (contacts from other companies linked here)
  let linkedContacts: Awaited<ReturnType<typeof getLinkedContacts>> = []
  try {
    linkedContacts = await getLinkedContacts(id)
  } catch {
    // Multi-company contacts migration may not be applied yet
  }

  // Fetch all customers for group member picker
  const { data: allCustomers } = await supabase
    .from('customers')
    .select('id, name')
    .order('name')

  // Check group management permission
  const currentUser = await getUser()
  const canManageGroups = currentUser ? hasPermission(currentUser, 'companies', 'manage_groups') : false

  // Fetch sales orders
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select(`
      id, so_number, customer_po, created_at,
      users!sales_orders_assigned_to_fkey(first_name, last_name, initials, color),
      sales_order_lines(id, status, quantity, sell_price, quantity_invoiced),
      quotes(opportunities(title))
    `)
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  const soRows = (salesOrders || []).map((so: Record<string, unknown>) => {
    const lines = (so.sales_order_lines || []) as { id: string; status: string; quantity: number; sell_price: number; quantity_invoiced: number }[]
    const quote = so.quotes as { opportunities: { title: string } | null } | null
    return {
      id: so.id as string,
      so_number: so.so_number as string,
      display_status: deriveSoDisplayStatus(lines),
      customer_po: so.customer_po as string | null,
      created_at: so.created_at as string,
      assigned_user: so.users as { first_name: string; last_name: string; initials: string | null; color: string | null } | null,
      line_count: lines.length,
      total: lines.reduce((s, l) => s + l.quantity * l.sell_price, 0),
      opportunity_title: quote?.opportunities?.title ?? null,
    }
  })

  // Fetch invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, invoice_type, total, created_at, due_date, paid_at, sales_orders(so_number)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  const invoiceRows = (invoices || []).map((inv: Record<string, unknown>) => ({
    id: inv.id as string,
    invoice_number: inv.invoice_number as string,
    status: inv.status as string,
    effective_status: getEffectiveInvoiceStatus(inv.status as 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | 'credit_note', inv.due_date as string | null),
    invoice_type: inv.invoice_type as string,
    total: inv.total as number,
    created_at: inv.created_at as string,
    due_date: inv.due_date as string | null,
    paid_at: inv.paid_at as string | null,
    so_number: (inv.sales_orders as Record<string, unknown> | null)?.so_number as string | null ?? null,
  }))

  if (!customer) notFound()

  const opps = opportunities || []
  const activeOpps = opps.filter((o: { stage: string }) => !['lost'].includes(o.stage))
  const pipelineValue = activeOpps.reduce(
    (s: number, o: { estimated_value: number | null }) => s + (o.estimated_value || 0),
    0
  )
  const openQuoteCount = (quotes || []).filter((q: { status: string }) => ['draft', 'sent', 'viewed'].includes(q.status)).length

  return (
    <div>
      {/* Back link */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6"
      >
        &larr; Customers
      </Link>

      {/* Customer header with edit */}
      <CustomerHeader customer={customer} />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Open Quotes" value={openQuoteCount} accent="#d97706" />
        <StatCard
          label="Opportunities"
          value={activeOpps.length}
          sub={`${formatCurrency(pipelineValue)} pipeline`}
          accent="#6366f1"
        />
        <StatCard
          label="Total Quotes"
          value={(quotes || []).length}
        />
        <StatCard
          label="Payment Terms"
          value={`${customer.payment_terms} days`}
          accent="#059669"
        />
      </div>

      {/* Search bar */}
      <div className="mb-8">
        <CustomerSearch customerId={id} />
      </div>

      {/* Customer info card */}
      <CollapsibleCard title="Customer Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Account Number" value={customer.account_number} />
          <DetailField label="Xero Reference" value={customer.xero_reference} />
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
      </CollapsibleCard>

      {/* Email Domains */}
      <EmailDomainsSection domains={emailDomains} customerId={id} />

      {/* Contacts */}
      <ContactsSection contacts={contacts || []} customerId={id} />

      {/* Portal Access */}
      <PortalAccessSection customerId={id} contacts={(contacts || []).map(c => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email }))} canEdit={true} />

      {/* Group Membership */}
      <GroupMembershipSection
        companyId={id}
        companyName={customer.name}
        customers={(allCustomers || []).map(c => ({ id: c.id, name: c.name }))}
        canManage={canManageGroups}
      />

      {/* Linked Contacts (from other companies) */}
      <LinkedContactsSection contacts={linkedContacts} customerId={id} />

      {/* Opportunities */}
      <OpportunitiesSection opportunities={opps} customerId={id} />

      {/* Quotes */}
      <QuotesSection quotes={quotes || []} />

      {/* Sales Orders */}
      <SalesOrdersSection salesOrders={soRows} />

      {/* Invoices */}
      <InvoicesSection invoices={invoiceRows} />

      {/* Contracts */}
      {contractsData.length > 0 && (
        <ContractsSection contracts={contractsData} customerId={id} />
      )}

      {/* Scheduled Visits */}
      {visitsData.length > 0 && (
        <VisitSchedulingSection visits={visitsData} />
      )}

      {/* Support Tickets */}
      {supportData && (
        <SupportTicketsSection
          tickets={supportData.tickets as never[]}
          activeCount={supportData.activeCount}
          contract={supportData.contract as never}
          timeUsedThisMonth={supportData.timeUsedThisMonth}
          customerId={id}
        />
      )}
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
      <div className="text-slate-700 dark:text-slate-300">{value || '\u2014'}</div>
    </div>
  )
}
