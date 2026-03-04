import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { CreateSoForm } from './create-so-form'

interface PageProps {
  searchParams: Promise<{ quote_id?: string }>
}

export default async function NewSalesOrderPage({ searchParams }: PageProps) {
  const { quote_id } = await searchParams
  if (!quote_id) redirect('/orders')

  const user = await requirePermission('sales_orders', 'create')
  const supabase = await createClient()

  // Guard: check if SO already exists for this quote
  const { data: existingSo } = await supabase
    .from('sales_orders')
    .select('id')
    .eq('quote_id', quote_id)
    .maybeSingle()

  if (existingSo) {
    redirect(`/orders/${existingSo.id}`)
  }

  // Fetch quote
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quote_id)
    .single()

  if (!quote) notFound()

  // Must be accepted and acknowledged
  if (quote.status !== 'accepted' || !quote.acknowledged_at) {
    redirect(`/quotes/${quote_id}`)
  }

  // Fetch related data in parallel
  const [
    { data: customer },
    { data: contact },
    { data: groups },
    { data: lines },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from('customers').select('id, name, address_line1, address_line2, city, county, postcode').eq('id', quote.customer_id).single(),
    quote.contact_id
      ? supabase.from('contacts').select('id, first_name, last_name, email').eq('id', quote.contact_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('quote_groups').select('*').eq('quote_id', quote_id).order('sort_order'),
    supabase.from('quote_lines').select('*, products(name, sku, is_stocked, is_serialised, default_delivery_destination), suppliers(name)').eq('quote_id', quote_id).order('sort_order'),
    supabase.from('users').select('id, first_name, last_name').eq('org_id', user.orgId).eq('is_active', true).order('first_name'),
  ])

  return (
    <div>
      <Link
        href={`/quotes/${quote_id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; Back to Quote
      </Link>

      <h2 className="text-2xl font-bold text-slate-900 mb-1">Create Sales Order</h2>
      <p className="text-sm text-slate-500 mb-6">
        Converting quote <span className="font-medium text-slate-700">{quote.quote_number}</span> for{' '}
        <span className="font-medium text-slate-700">{customer?.name}</span>
      </p>

      <CreateSoForm
        quote={quote}
        customer={customer}
        contact={contact}
        groups={(groups || []) as { id: string; name: string; sort_order: number }[]}
        lines={(lines || []) as {
          id: string; group_id: string | null; sort_order: number; description: string;
          quantity: number; buy_price: number; sell_price: number;
          fulfilment_route: string; is_optional: boolean; requires_contract: boolean;
          products: { name: string; sku: string; is_stocked: boolean; is_serialised: boolean | null; default_delivery_destination: string } | null;
          suppliers: { name: string } | null;
        }[]}
        teamMembers={(teamMembers || []) as { id: string; first_name: string; last_name: string }[]}
        currentUserId={user.id}
      />
    </div>
  )
}
