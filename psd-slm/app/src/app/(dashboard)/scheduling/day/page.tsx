import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getJobs, getJobTypes, getEngineers, getActivities, getActiveActivityTypes, getWorkingDays } from '../actions'
import { DispatchCalendar } from '../dispatch-calendar'
import { SchedulingActions } from '../scheduling-actions'

export default async function DayViewPage() {
  const user = await requirePermission('scheduling', 'view')
  const canCreate = user.permissions.includes('scheduling.create')
  const canEdit = user.permissions.includes('scheduling.edit')
  const isAdmin = user.permissions.includes('scheduling.admin')

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [jobsResult, typesResult, engineersResult, activitiesResult, activityTypesResult, workingDays] = await Promise.all([
    getJobs(),
    getJobTypes(),
    getEngineers(),
    getActivities(),
    getActiveActivityTypes(),
    getWorkingDays(),
  ])

  return (
    <div>
      <PageHeader
        title="Day View"
        subtitle="Dispatch calendar"
        actions={
          <SchedulingActions
            isAdmin={isAdmin}
            canCreate={canCreate}
            activityTypes={activityTypesResult.data || []}
            engineers={(engineersResult.data || []).map(e => ({ id: e.id, first_name: e.first_name, last_name: e.last_name }))}
            workingDays={workingDays}
          />
        }
      />
      <DispatchCalendar
        allJobs={jobsResult.data || []}
        allActivities={activitiesResult.data || []}
        jobTypes={typesResult.data || []}
        engineers={engineersResult.data || []}
        initialDate={today}
        canEdit={canEdit}
      />
    </div>
  )
}
