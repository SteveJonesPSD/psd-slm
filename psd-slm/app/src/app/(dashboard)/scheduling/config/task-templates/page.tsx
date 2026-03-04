import { requirePermission } from '@/lib/auth'
import { getTaskTemplates } from '../../actions'
import { TaskTemplatesManager } from './task-templates-manager'

export default async function TaskTemplatesPage() {
  await requirePermission('scheduling', 'admin')

  const result = await getTaskTemplates()

  return <TaskTemplatesManager initialTemplates={result.data || []} />
}
