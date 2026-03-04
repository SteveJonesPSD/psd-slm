import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { CategoriesList } from './categories-list'

export default async function CategoriesPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('product_categories')
    .select('*, products(count)')
    .order('sort_order')

  const mapped = (categories || []).map((c) => ({
    ...c,
    product_count: (c.products as unknown as { count: number }[])?.[0]?.count ?? 0,
  }))

  return (
    <div>
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-4"
      >
        &larr; Products
      </Link>

      <PageHeader
        title="Product Categories"
        subtitle={`${mapped.length} categor${mapped.length === 1 ? 'y' : 'ies'}`}
      />

      <CategoriesList categories={mapped} />
    </div>
  )
}
