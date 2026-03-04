import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { ProductForm } from '../../product-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: product }, { data: categories }, { data: allProducts }, { data: preferredSupplierLink }] = await Promise.all([
    supabase
      .from('products')
      .select('*, product_categories(id, name, requires_serial)')
      .eq('id', id)
      .single(),
    supabase.from('product_categories').select('*').order('sort_order'),
    supabase.from('products').select('manufacturer').not('manufacturer', 'is', null),
    supabase
      .from('product_suppliers')
      .select('*, suppliers(id, name, account_number)')
      .eq('product_id', id)
      .eq('is_preferred', true)
      .maybeSingle(),
  ])

  const manufacturers = [...new Set((allProducts || []).map((p) => p.manufacturer).filter(Boolean) as string[])].sort()

  if (!product) notFound()

  const cat = product.product_categories as unknown as { id: string; name: string; requires_serial: boolean } | null
  const preferredSupplier = preferredSupplierLink?.suppliers
    ? { id: (preferredSupplierLink.suppliers as { id: string; name: string; account_number: string | null }).id, name: (preferredSupplierLink.suppliers as { id: string; name: string; account_number: string | null }).name, account_number: (preferredSupplierLink.suppliers as { id: string; name: string; account_number: string | null }).account_number }
    : undefined

  return (
    <div>
      <Link
        href={`/products/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; {product.name}
      </Link>

      <PageHeader title="Edit Product" subtitle={product.sku} />
      <ProductForm
        product={{ ...product, category: cat }}
        categories={categories || []}
        manufacturers={manufacturers}
        preferredSupplier={preferredSupplier}
      />
    </div>
  )
}
