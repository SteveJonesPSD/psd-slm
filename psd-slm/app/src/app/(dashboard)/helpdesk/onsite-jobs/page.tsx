import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getOnsiteJobItems, getOnsiteJobCategories } from './actions'
import { OnsiteJobsList } from './onsite-jobs-list'

export default async function OnsiteJobsPage() {
  const user = await requirePermission('onsite_jobs', 'view')
  const isAdmin = user.permissions.includes('onsite_jobs.admin')
  const supabase = await createClient()

  const [itemsResult, catsResult, customersResult] = await Promise.all([
    getOnsiteJobItems(),
    getOnsiteJobCategories(),
    supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
  ])

  const items = itemsResult.data || []
  const categories = (catsResult.data || []).filter(c => c.is_active)
  const customers = (customersResult.data || []) as { id: string; name: string }[]

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
      isAdmin={isAdmin}
      customers={customers}
    />
  )
}
