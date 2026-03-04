import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatCurrency } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { SupplierProducts } from './supplier-products'
import { SupplierIntegrationTab } from './supplier-integration'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()

  if (!supplier) notFound()

  const { data: productSuppliers } = await supabase
    .from('product_suppliers')
    .select('*, products(id, sku, name, is_active)')
    .eq('supplier_id', id)

  const { data: integration } = await supabase
    .from('supplier_integrations')
    .select('*')
    .eq('supplier_id', id)
    .maybeSingle()

  const products = productSuppliers || []

  return (
    <div>
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; Suppliers
      </Link>

      <PageHeader
        title={supplier.name}
        subtitle={supplier.account_number || undefined}
        actions={
          <div className="flex items-center gap-2">
            {supplier.is_active
              ? <Badge label="Active" color="#059669" bg="#ecfdf5" />
              : <Badge label="Inactive" color="#6b7280" bg="#f3f4f6" />}
            <Link href={`/suppliers/${id}/edit`}>
              <Button size="sm">Edit</Button>
            </Link>
          </div>
        }
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-5 mb-6">
        <StatCard label="Products" value={products.length} />
        <StatCard label="Payment Terms" value={`${supplier.payment_terms} days`} accent="#059669" />
        <StatCard label="Created" value={formatDate(supplier.created_at)} />
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <h3 className="text-[15px] font-semibold mb-3">Supplier Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Email" value={supplier.email} />
          <DetailField label="Phone" value={supplier.phone} />
          <DetailField
            label="Website"
            value={supplier.website}
            isLink
          />
          <DetailField label="Payment Terms" value={`${supplier.payment_terms} days`} />
          <DetailField label="Created" value={formatDate(supplier.created_at)} />
          <DetailField label="Updated" value={formatDate(supplier.updated_at)} />
          {supplier.notes && (
            <DetailField label="Notes" value={supplier.notes} className="col-span-2 lg:col-span-3" />
          )}
        </div>
      </div>

      {/* Products tab */}
      <SupplierProducts
        supplierId={id}
        supplierName={supplier.name}
        productSuppliers={products}
      />

      {/* Integration tab */}
      <SupplierIntegrationTab integration={integration} />

      {/* Future tabs placeholder */}
      <div className="mt-5 flex gap-3">
        <span className="text-xs text-slate-300 border border-slate-200 rounded-lg px-3 py-1.5 cursor-not-allowed" title="Coming in Module 7">
          Purchase Orders
        </span>
        <span className="text-xs text-slate-300 border border-slate-200 rounded-lg px-3 py-1.5 cursor-not-allowed" title="Coming in Module 4">
          Deal Registrations
        </span>
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  className,
  isLink,
}: {
  label: string
  value: string | null | undefined
  className?: string
  isLink?: boolean
}) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      {isLink && value ? (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {value}
        </a>
      ) : (
        <div className="text-slate-700">{value || '\u2014'}</div>
      )}
    </div>
  )
}
