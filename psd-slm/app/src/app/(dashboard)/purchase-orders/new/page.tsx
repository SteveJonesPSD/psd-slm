import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import Link from 'next/link'
import { StockOrderForm } from './stock-order-form'

export default async function NewStockOrderPage() {
  const user = await requirePermission('purchase_orders', 'create')
  const supabase = await createClient()

  // Fetch suppliers and products for the form
  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, sku, default_buy_price, product_type, product_suppliers(supplier_id, standard_cost, supplier_sku)')
      .eq('org_id', user.orgId)
      .eq('is_active', true)
      .eq('product_type', 'goods')
      .order('name'),
  ])

  return (
    <div>
      <Link
        href="/purchase-orders"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; Purchase Orders
      </Link>

      <PageHeader
        title="New Stock Order"
        subtitle="Raise a purchase order to replenish general inventory"
      />

      <StockOrderForm
        suppliers={suppliers || []}
        products={(products || []) as { id: string; name: string; sku: string; default_buy_price: number; product_type: string; product_suppliers: { supplier_id: string; standard_cost: number; supplier_sku: string | null }[] }[]}
      />
    </div>
  )
}
