import { requirePermission } from '@/lib/auth'
import { getOnsiteJobItem, getOnsiteJobCategories } from '../actions'
import { notFound } from 'next/navigation'
import { OnsiteJobDetail } from './onsite-job-detail'

export default async function OnsiteJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('onsite_jobs', 'view')
  const { id } = await params

  const [result, catsResult] = await Promise.all([
    getOnsiteJobItem(id),
    getOnsiteJobCategories(),
  ])

  if (result.error || !result.data) return notFound()

  const canEdit = user.permissions.includes('onsite_jobs.edit')
  const canNotifySales = user.permissions.includes('onsite_jobs.notify_sales')
  const canCancel = user.permissions.includes('onsite_jobs.cancel')

  return (
    <OnsiteJobDetail
      item={result.data}
      audit={result.data.audit}
      categories={(catsResult.data || []).filter(c => c.is_active)}
      canEdit={canEdit}
      canNotifySales={canNotifySales}
      canCancel={canCancel}
    />
  )
}
