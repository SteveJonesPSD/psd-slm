import { PageHeader } from '@/components/ui/page-header'
import { getDepartments, getTeamMembers } from '../actions'
import { DepartmentsManager } from './departments-manager'

export default async function DepartmentsPage() {
  const [deptResult, teamMembers] = await Promise.all([
    getDepartments(),
    getTeamMembers(),
  ])

  const departments = deptResult.data || []

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle={`${departments.length} departments configured`}
      />
      <DepartmentsManager
        initialData={departments}
        teamMembers={teamMembers}
      />
    </div>
  )
}
