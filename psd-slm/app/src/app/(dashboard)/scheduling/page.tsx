import { Suspense } from 'react'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getJobs, getEngineers, getMyScheduleRange, getActivities, getActiveActivityTypes, getWorkingDays, getAllUserWorkingHours } from './actions'
import { WeekView } from './week/week-view'
import { MobileDetector } from '@/components/ui/mobile-detector'
import { MobileScheduleView } from './mobile-schedule-view'
import { SchedulingActions } from './scheduling-actions'
import Link from 'next/link'

export default async function SchedulingPage() {
  const user = await requirePermission('scheduling', 'view')
  const canCreate = user.permissions.includes('scheduling.create')
  const canEdit = user.permissions.includes('scheduling.edit')
  const isAdmin = user.permissions.includes('scheduling.admin')

  const [jobsResult, engineersResult, mySchedule, activitiesResult, activityTypesResult, workingDays, userHoursResult] = await Promise.all([
    getJobs(),
    getEngineers(),
    getMyScheduleRange(),
    getActivities(),
    getActiveActivityTypes(),
    getWorkingDays(),
    getAllUserWorkingHours(),
  ])

  // Get Monday of current week
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

  const desktop = (
    <div>
      <PageHeader
        title="Scheduling"
        subtitle="Dispatch calendar and job management"
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
      <Suspense fallback={null}>
        <WeekView
          allJobs={jobsResult.data || []}
          allActivities={activitiesResult.data || []}
          engineers={engineersResult.data || []}
          initialWeekStart={weekStart}
          canEdit={canEdit}
          workingDays={workingDays}
          allUserHours={userHoursResult.data || []}
          activityTypes={activityTypesResult.data || []}
        />
      </Suspense>
    </div>
  )

  const mobile = (
    <MobileScheduleView
      jobs={mySchedule.jobs}
      activities={mySchedule.activities}
      today={mySchedule.today}
      canCreate={canCreate}
      workingDays={workingDays}
    />
  )

  return <MobileDetector desktop={desktop} mobile={mobile} />
}
