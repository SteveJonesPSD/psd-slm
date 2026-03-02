import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { TemplateEditor } from '../template-editor'

export default async function NewTemplatePage() {
  await requirePermission('templates', 'create')
  const supabase = await createClient()

  const [
    { data: rawProducts },
    { data: categories },
    { data: suppliers },
    { data: productSuppliers },
  ] = await Promise.all([
    supabase.from('products').select('id, sku, name, category_id, default_buy_price, default_sell_price, product_categories(name)').eq('is_active', true).order('name'),
    supabase.from('product_categories').select('id, name').order('sort_order'),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
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

  return (
    <TemplateEditor
      products={products}
      categories={categories || []}
      suppliers={suppliers || []}
      productSuppliers={productSuppliers || []}
    />
  )
}
