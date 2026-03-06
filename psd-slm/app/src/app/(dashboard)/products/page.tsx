import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { ProductsTable } from './products-table'
import { ProductsPageActions } from './products-page-actions'
import Link from 'next/link'

export default async function ProductsPage() {
  const supabase = await createClient()

  const [{ data: products }, { data: categories }, { data: stockLevels }] = await Promise.all([
    supabase
      .from('products')
      .select('*, product_categories(id, name, requires_serial), product_suppliers(id, is_preferred, suppliers(name))')
      .order('name'),
    supabase.from('product_categories').select('*').order('sort_order'),
    supabase.from('stock_levels').select('product_id, quantity_on_hand, quantity_allocated'),
  ])

  // Aggregate stock per product across all locations
  const stockByProduct = new Map<string, { on_hand: number; allocated: number }>()
  for (const sl of stockLevels || []) {
    const existing = stockByProduct.get(sl.product_id) || { on_hand: 0, allocated: 0 }
    existing.on_hand += sl.quantity_on_hand
    existing.allocated += sl.quantity_allocated
    stockByProduct.set(sl.product_id, existing)
  }

  const mapped = (products || []).map((p) => {
    const cat = p.product_categories as unknown as { id: string; name: string; requires_serial: boolean } | null
    const suppliers = p.product_suppliers as unknown as { id: string; is_preferred: boolean; suppliers: { name: string } | null }[] | null
    const preferred = suppliers?.find((s) => s.is_preferred)
    const stock = stockByProduct.get(p.id)
    const totalStock = stock ? stock.on_hand : 0
    const allocatedStock = stock ? stock.allocated : 0
    const unallocatedStock = totalStock - allocatedStock
    return {
      ...p,
      category_name: cat?.name || null,
      category_requires_serial: cat?.requires_serial ?? false,
      supplier_count: suppliers?.length ?? 0,
      main_supplier_name: preferred?.suppliers?.name || null,
      total_stock: totalStock,
      allocated_stock: allocatedStock,
      unallocated_stock: unallocatedStock,
    }
  })

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${mapped.length} in catalogue`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/products/categories">
              <Button size="sm">Manage Categories</Button>
            </Link>
            <ProductsPageActions />
          </div>
        }
      />
      <ProductsTable products={mapped} categories={categories || []} />
    </div>
  )
}
