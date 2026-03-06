import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { SuppliersTable } from './suppliers-table'
import { SuppliersPageActions } from './suppliers-page-actions'

export default async function SuppliersPage() {
  const supabase = await createClient()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*, product_suppliers(id)')
    .order('name')

  const mapped = (suppliers || []).map((s) => ({
    ...s,
    product_count: (s.product_suppliers as unknown as { id: string }[])?.length ?? 0,
  }))

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${mapped.length} supplier${mapped.length === 1 ? '' : 's'}`}
        actions={<SuppliersPageActions />}
      />
      <SuppliersTable suppliers={mapped} />
    </div>
  )
}
