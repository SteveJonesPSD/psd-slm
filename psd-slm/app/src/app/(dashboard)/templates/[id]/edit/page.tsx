import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { TemplateEditor } from '../../template-editor'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('templates', 'edit')
  const supabase = await createClient()

  const [
    { data: template },
    { data: rawProducts },
    { data: categories },
    { data: suppliers },
    { data: productSuppliers },
  ] = await Promise.all([
    supabase
      .from('quote_templates')
      .select('*, quote_template_groups(*), quote_template_lines(*)')
      .eq('id', id)
      .single(),
    supabase.from('products').select('id, sku, name, category_id, default_buy_price, default_sell_price, default_route, product_categories(name)').eq('is_active', true).order('name'),
    supabase.from('product_categories').select('id, name').order('sort_order'),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
    supabase.from('product_suppliers').select('product_id, supplier_id, standard_cost, is_preferred'),
  ])

  if (!template) notFound()

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

  return (
    <TemplateEditor
      products={products}
      categories={categories || []}
      suppliers={suppliers || []}
      productSuppliers={productSuppliers || []}
      existingTemplate={template as unknown as {
        id: string
        name: string
        description: string | null
        category: string | null
        default_quote_type: string | null
        is_active: boolean
        quote_template_groups: { id: string; name: string; sort_order: number }[]
        quote_template_lines: {
          id: string; group_id: string | null; product_id: string | null; supplier_id: string | null;
          sort_order: number; description: string; quantity: number;
          default_buy_price: number; default_sell_price: number;
          fulfilment_route: string; is_optional: boolean; requires_contract: boolean; notes: string | null
        }[]
      }}
    />
  )
}
