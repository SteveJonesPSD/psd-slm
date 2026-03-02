import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { BrandForm } from '../../brand-form'
import type { Brand } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditBrandPage({ params }: Props) {
  const { id } = await params
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: brand, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.orgId)
    .single()

  if (error || !brand) {
    notFound()
  }

  return (
    <div>
      <PageHeader
        title={`Edit: ${brand.name}`}
        subtitle="Update brand details and document settings"
      />
      <BrandForm brand={brand as Brand} />
    </div>
  )
}
