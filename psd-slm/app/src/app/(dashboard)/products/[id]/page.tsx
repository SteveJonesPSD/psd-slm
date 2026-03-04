import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { SerialisedBadge } from '@/components/ui/serialised-badge'
import { resolveSerialisedStatus } from '@/lib/products'
import { getMarginColor } from '@/lib/margin'
import { ProductSuppliers } from './product-suppliers'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('*, product_categories(id, name, requires_serial)')
    .eq('id', id)
    .single()

  if (!product) notFound()

  const { data: productSuppliers } = await supabase
    .from('product_suppliers')
    .select('*, suppliers(id, name, account_number, is_active)')
    .eq('product_id', id)

  const cat = product.product_categories as unknown as { id: string; name: string; requires_serial: boolean } | null
  const categoryRequiresSerial = cat?.requires_serial ?? false
  const isSerialised = resolveSerialisedStatus(product.is_serialised, categoryRequiresSerial, product.product_type)
  const isService = product.product_type === 'service'
  const suppliers = productSuppliers || []
  const mainSupplier = suppliers.find((s) => s.is_preferred)
  const mainSupplierInfo = mainSupplier?.suppliers as { id: string; name: string; account_number: string | null; is_active: boolean } | undefined

  const marginPct = (product.default_sell_price != null && product.default_buy_price != null && product.default_sell_price > 0)
    ? ((product.default_sell_price - product.default_buy_price) / product.default_sell_price * 100).toFixed(1) + '%'
    : 'N/A'

  const marginColor = getMarginColor(product.default_buy_price, product.default_sell_price)

  // Serialisation source text
  const serialSource = product.is_serialised === null
    ? 'From category'
    : 'Product override'

  return (
    <div>
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; Products
      </Link>

      <PageHeader
        title={product.name}
        subtitle={product.sku}
        actions={
          <div className="flex items-center gap-2">
            {isService ? (
              <Badge label="Service" color="#7c3aed" bg="#f5f3ff" />
            ) : (
              <Badge label="Goods" color="#475569" bg="#f1f5f9" />
            )}
            {cat && (
              <Badge label={cat.name} color="#64748b" bg="#f1f5f9" />
            )}
            {!isService && (
              <SerialisedBadge
                productIsSerialised={product.is_serialised}
                categoryRequiresSerial={categoryRequiresSerial}
              />
            )}
            {!isService && product.is_stocked && (
              <Badge label="Stocked" color="#059669" bg="#ecfdf5" />
            )}
            {!product.is_active && (
              <Badge label="Inactive" color="#6b7280" bg="#f3f4f6" />
            )}
            <Link href={`/products/${id}/edit`}>
              <Button size="sm">Edit</Button>
            </Link>
          </div>
        }
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-6 mb-8">
        <StatCard
          label="Default Buy Price"
          value={product.default_buy_price != null ? formatCurrency(product.default_buy_price) : 'Not set'}
        />
        <StatCard
          label="Default Sell Price"
          value={product.default_sell_price != null ? formatCurrency(product.default_sell_price) : 'Not set'}
          accent="#2563eb"
        />
        <StatCard
          label="Default Margin"
          value={marginPct}
          accent={marginColor ? undefined : '#6b7280'}
        />
        <StatCard label="Suppliers" value={suppliers.length} accent="#8b5cf6" />
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <h3 className="text-[15px] font-semibold mb-4">Product Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField label="SKU" value={product.sku} />
          <DetailField label="Name" value={product.name} />
          <DetailField label="Product Type" value={isService ? 'Service' : 'Goods'} />
          <DetailField label="Category" value={cat?.name} />
          {!isService && <DetailField label="Manufacturer" value={product.manufacturer} />}
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">
              Main Supplier
            </div>
            <div className="text-slate-700">
              {mainSupplierInfo ? (
                <Link href={`/suppliers/${mainSupplierInfo.id}`} className="text-blue-600 hover:underline no-underline">
                  {mainSupplierInfo.name}
                </Link>
              ) : (
                '\u2014'
              )}
            </div>
          </div>
          {!isService && <DetailField label="Stocked" value={product.is_stocked ? 'Yes' : 'No'} />}
          {!isService && (
            <DetailField
              label="Default Delivery"
              value={product.default_delivery_destination === 'customer_site' ? 'Customer Site' : 'Warehouse'}
            />
          )}
          {!isService && (
            <DetailField
              label="Serialisation"
              value={`${isSerialised ? 'Yes' : 'No'} (${serialSource})`}
            />
          )}
          <DetailField label="Created" value={formatDate(product.created_at)} />
          <DetailField label="Updated" value={formatDate(product.updated_at)} />
          {product.description && (
            <DetailField label="Description" value={product.description} className="col-span-2 lg:col-span-3" />
          )}
        </div>
      </div>

      {/* Suppliers tab */}
      <ProductSuppliers
        productId={id}
        productName={product.name}
        productSuppliers={suppliers}
      />
      {isService && suppliers.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">Suppliers can be linked for subcontracted services.</p>
      )}

      {/* Future tabs placeholder */}
      <div className="mt-5 flex gap-3">
        <span className="text-xs text-slate-300 border border-slate-200 rounded-lg px-3 py-1.5 cursor-not-allowed" title="Coming in Module 4">
          Deal Registrations
        </span>
        {!isService && (
          <span className="text-xs text-slate-300 border border-slate-200 rounded-lg px-3 py-1.5 cursor-not-allowed" title="Coming in Module 8">
            Stock
          </span>
        )}
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string
  value: string | null | undefined
  className?: string
}) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="text-slate-700">{value || '\u2014'}</div>
    </div>
  )
}
