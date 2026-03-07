import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { addBusinessDays } from '@/lib/utils'
import { getMarginThresholds } from '@/lib/margin-settings'
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
    { data: directContacts },
    { data: contactLinks },
    { data: rawProducts },
    { data: categories },
    { data: suppliers },
    { data: users },
    { data: brands },
    { data: dealPricing },
    { data: productSuppliers },
    { data: opportunity },
    { data: validitySetting },
  ] = await Promise.all([
    supabase.from('customers').select('id, name, customer_type').eq('is_active', true).order('name'),
    supabase.from('contacts').select('id, customer_id, first_name, last_name, email, is_primary').eq('is_active', true),
    supabase.from('contact_customer_links').select('contact_id, customer_id'),
    supabase.from('products').select('id, sku, name, category_id, default_buy_price, default_sell_price, default_route, product_categories(name)').eq('is_active', true).order('name'),
    supabase.from('product_categories').select('id, name').order('sort_order'),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
    supabase.from('users').select('id, first_name, last_name, initials, color').eq('is_active', true).order('first_name'),
    supabase.from('brands').select('id, name, logo_path, is_default, customer_type').eq('is_active', true).order('sort_order'),
    supabase.from('v_active_deal_pricing').select('*'),
    supabase.from('product_suppliers').select('product_id, supplier_id, standard_cost, is_preferred'),
    opportunity_id
      ? supabase.from('opportunities').select('id, customer_id, title').eq('id', opportunity_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('org_settings').select('setting_value').eq('org_id', user.orgId).eq('category', 'general').eq('setting_key', 'quote_validity_days').single(),
  ])

  // Build contacts list: direct contacts + linked contacts (with linked customer_id)
  const contactsById = new Map((directContacts || []).map((c) => [c.id, c]))
  const allContacts = (directContacts || []).map((c) => ({ ...c, email: c.email || null }))
  for (const link of contactLinks || []) {
    const contact = contactsById.get(link.contact_id)
    if (contact && link.customer_id !== contact.customer_id) {
      allContacts.push({ ...contact, customer_id: link.customer_id, email: contact.email || null })
    }
  }

  // Transform products to include category_name
  const products = (rawProducts || []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category_id: p.category_id,
    category_name: (p.product_categories as unknown as { name: string } | null)?.name || null,
    default_buy_price: p.default_buy_price,
    default_sell_price: p.default_sell_price,
    default_route: p.default_route || 'from_stock',
  }))

  const validityDays = parseInt(validitySetting?.setting_value ?? '14', 10) || 14
  const defaultValidUntil = addBusinessDays(new Date(), validityDays)
  const marginThresholds = await getMarginThresholds()

  return (
    <QuoteBuilder
      customers={customers || []}
      contacts={allContacts}
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
      defaultValidUntil={defaultValidUntil}
      marginThresholds={marginThresholds}
    />
  )
}
