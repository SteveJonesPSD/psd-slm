import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { ProductsTable } from './products-table'
import Link from 'next/link'

export default async function ProductsPage() {
  const supabase = await createClient()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select('*, product_categories(id, name, requires_serial), product_suppliers(id, is_preferred, suppliers(name))')
      .order('name'),
    supabase.from('product_categories').select('*').order('sort_order'),
  ])

  const mapped = (products || []).map((p) => {
    const cat = p.product_categories as unknown as { id: string; name: string; requires_serial: boolean } | null
    const suppliers = p.product_suppliers as unknown as { id: string; is_preferred: boolean; suppliers: { name: string } | null }[] | null
    const preferred = suppliers?.find((s) => s.is_preferred)
    return {
      ...p,
      category_name: cat?.name || null,
      category_requires_serial: cat?.requires_serial ?? false,
      supplier_count: suppliers?.length ?? 0,
      main_supplier_name: preferred?.suppliers?.name || null,
    }
  })

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${mapped.length} in catalogue`}
        actions={
          <Link href="/products/categories">
            <Button size="sm">Manage Categories</Button>
          </Link>
        }
      />
      <ProductsTable products={mapped} categories={categories || []} />
    </div>
  )
}
