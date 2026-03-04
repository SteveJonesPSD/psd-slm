import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { QuoteBuilder } from '../builder/quote-builder'

interface PageProps {
  searchParams: Promise<{ opportunity_id?: string }>
}

export default async function NewQuotePage({ searchParams }: PageProps) {
  const { opportunity_id } = await searchParams
  const user = await requirePermission('quotes', 'create')
  const supabase = await createClient()

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
    { data: opportunity },
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
    opportunity_id
      ? supabase.from('opportunities').select('id, customer_id, title').eq('id', opportunity_id).single()
      : Promise.resolve({ data: null }),
  ])

  // Transform products to include category_name
  const products = (rawProducts || []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category_id: p.category_id,
    category_name: (p.product_categories as unknown as { name: string } | null)?.name || null,
    default_buy_price: p.default_buy_price,
    default_sell_price: p.default_sell_price,
  }))

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
      opportunityId={opportunity_id || null}
      opportunityCustomerId={opportunity?.customer_id || null}
    />
  )
}
