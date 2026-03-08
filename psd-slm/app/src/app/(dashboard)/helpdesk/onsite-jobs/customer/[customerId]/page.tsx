import { requirePermission } from '@/lib/auth'
import { getOnsiteJobItems, getOnsiteJobCategories } from '../../actions'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { OnsiteJobsList } from '../../onsite-jobs-list'

export default async function CustomerOnsiteJobsPage({ params }: { params: Promise<{ customerId: string }> }) {
  const user = await requirePermission('onsite_jobs', 'view')
  const { customerId } = await params
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('name')
    .eq('id', customerId)
    .single()

  if (!customer) return notFound()

  const [itemsResult, catsResult] = await Promise.all([
    getOnsiteJobItems({ customerId }),
    getOnsiteJobCategories(),
  ])

  const items = itemsResult.data || []
  const categories = (catsResult.data || []).filter(c => c.is_active)

  const pendingCount = items.filter(i => i.status === 'pending').length
  const inProgressCount = items.filter(i => i.status === 'in_progress').length
  const escalatedCount = items.filter(i => i.status === 'escalated').length

  return (
    <OnsiteJobsList
      items={items}
      categories={categories}
      pendingCount={pendingCount}
      inProgressCount={inProgressCount}
      escalatedCount={escalatedCount}
      isAdmin={user.permissions.includes('onsite_jobs.admin')}
      customerId={customerId}
      customerName={customer.name}
    />
  )
}
