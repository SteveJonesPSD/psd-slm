import { requirePermission } from '@/lib/auth'
import { getAllJobTypes, getTaskTemplates } from '../../actions'
import { JobTypesManager } from './job-types-manager'

export default async function JobTypesPage() {
  await requirePermission('scheduling', 'admin')

  const [typesResult, templatesResult] = await Promise.all([
    getAllJobTypes(),
    getTaskTemplates(),
  ])

  return (
    <JobTypesManager
      initialTypes={typesResult.data || []}
      templates={templatesResult.data || []}
    />
  )
}
