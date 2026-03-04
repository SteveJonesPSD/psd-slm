import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { ProductForm } from '../product-form'

export default async function NewProductPage() {
  const supabase = await createClient()
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from('product_categories').select('*').order('sort_order'),
    supabase.from('products').select('manufacturer').not('manufacturer', 'is', null),
  ])

  const manufacturers = [...new Set((products || []).map((p) => p.manufacturer).filter(Boolean) as string[])].sort()

  return (
    <div>
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; Products
      </Link>

      <PageHeader title="New Product" />
      <ProductForm categories={categories || []} manufacturers={manufacturers} />
    </div>
  )
}
