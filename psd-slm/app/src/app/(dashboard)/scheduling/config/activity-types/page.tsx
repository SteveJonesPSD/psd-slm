import { requirePermission } from '@/lib/auth'
import { getActivityTypes } from '../../actions'
import { ActivityTypesManager } from './activity-types-manager'

export default async function ActivityTypesPage() {
  await requirePermission('scheduling', 'admin')

  const result = await getActivityTypes()

  return <ActivityTypesManager initialTypes={result.data || []} />
}
