import { requirePermission } from '@/lib/auth'
import { getOnsiteJobCategories } from '../actions'
import { CategoriesConfig } from './categories-config'

export default async function OnsiteJobsConfigPage() {
  await requirePermission('onsite_jobs', 'admin')

  const result = await getOnsiteJobCategories()
  const categories = result.data || []

  return <CategoriesConfig categories={categories} />
}
