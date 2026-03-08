import { requirePortalSession } from '@/lib/portal/session'
import { getPortalOnsiteJobCategories } from '@/lib/portal/onsite-job-actions'
import { PortalNewOjiForm } from './portal-new-oji-form'

export default async function PortalNewOnsiteJobPage() {
  const ctx = await requirePortalSession()
  const categories = await getPortalOnsiteJobCategories(ctx)

  return <PortalNewOjiForm categories={categories} />
}
