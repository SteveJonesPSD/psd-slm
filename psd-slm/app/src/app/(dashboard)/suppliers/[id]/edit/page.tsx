import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { SupplierForm } from '../../supplier-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditSupplierPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()

  if (!supplier) notFound()

  return (
    <div>
      <Link
        href={`/suppliers/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; {supplier.name}
      </Link>

      <PageHeader title="Edit Supplier" subtitle={supplier.name} />
      <SupplierForm supplier={supplier} />
    </div>
  )
}
