import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, hasPermission } from '@/lib/auth'
import { QuoteBuilder } from '../../builder/quote-builder'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditQuotePage({ params }: PageProps) {
  const { id } = await params
  const user = await requireAuth()
  if (!hasPermission(user, 'quotes', 'edit_all') && !hasPermission(user, 'quotes', 'edit_own')) {
    throw new Error('Permission denied: quotes.edit')
  }

  const supabase = await createClient()

  // Fetch the quote with children
  const { data: quote } = await supabase
    .from('quotes')
    .select('*, quote_groups(*), quote_lines(*), quote_attributions(*)')
    .eq('id', id)
    .single()

  if (!quote) notFound()

  // Only allow editing draft or review quotes
  if (!['draft', 'review'].includes(quote.status)) {
    redirect(`/quotes/${id}`)
  }

  // Fetch all lookups in parallel
  const [
    { data: customers },
    { data: contacts },
    { data: rawProducts },
    { data: categories },
    { data: suppliers },
    { data: users },
    { data: brands },
    { data: dealPricing },
    { data: productSuppliers },
  ] = await Promise.all([
    supabase.from('customers').select('id, name, customer_type').eq('is_active', true).order('name'),
    supabase.from('contacts').select('id, customer_id, first_name, last_name, email').eq('is_active', true),
    supabase.from('products').select('id, sku, name, category_id, default_buy_price, default_sell_price, product_categories(name)').eq('is_active', true).order('name'),
    supabase.from('product_categories').select('id, name').order('sort_order'),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
    supabase.from('users').select('id, first_name, last_name, initials, color').eq('is_active', true).order('first_name'),
    supabase.from('brands').select('id, name, logo_path, is_default, customer_type').eq('is_active', true).order('sort_order'),
    supabase.from('v_active_deal_pricing').select('*'),
    supabase.from('product_suppliers').select('product_id, supplier_id, standard_cost, is_preferred'),
  ])

  const products = (rawProducts || []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category_id: p.category_id,
    category_name: (p.product_categories as unknown as { name: string } | null)?.name || null,
    default_buy_price: p.default_buy_price,
    default_sell_price: p.default_sell_price,
  }))

  // Sort groups and lines by sort_order
  const sortedGroups = (quote.quote_groups as { id: string; name: string; sort_order: number }[])
    .sort((a, b) => a.sort_order - b.sort_order)

  const sortedLines = (quote.quote_lines as { id: string; group_id: string | null; sort_order: number; [key: string]: unknown }[])
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <QuoteBuilder
      customers={customers || []}
      contacts={(contacts || []).map((c) => ({ ...c, email: c.email || null }))}
      products={products}
      categories={categories || []}
      suppliers={suppliers || []}
      users={users || []}
      brands={brands || []}
      productSuppliers={productSuppliers || []}
      dealPricing={dealPricing || []}
      currentUserId={user.id}
      existingQuote={{
        id: quote.id,
        quote_number: quote.quote_number,
        customer_id: quote.customer_id,
        contact_id: quote.contact_id,
        opportunity_id: quote.opportunity_id,
        assigned_to: quote.assigned_to,
        brand_id: quote.brand_id,
        quote_type: quote.quote_type,
        valid_until: quote.valid_until,
        vat_rate: quote.vat_rate,
        customer_notes: quote.customer_notes,
        internal_notes: quote.internal_notes,
        quote_groups: sortedGroups,
        quote_lines: sortedLines as typeof quote.quote_lines,
        quote_attributions: quote.quote_attributions as { id: string; user_id: string; attribution_type: string; split_pct: number }[],
      }}
    />
  )
}
