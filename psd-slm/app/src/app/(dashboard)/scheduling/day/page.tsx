import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getJobs, getJobTypes, getEngineers } from '../actions'
import { DispatchCalendar } from '../dispatch-calendar'
import Link from 'next/link'

export default async function DayViewPage() {
  const user = await requirePermission('scheduling', 'view')
  const canCreate = user.permissions.includes('scheduling.create')
  const canEdit = user.permissions.includes('scheduling.edit')

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [jobsResult, typesResult, engineersResult] = await Promise.all([
    getJobs(),
    getJobTypes(),
    getEngineers(),
  ])

  return (
    <div>
      <PageHeader
        title="Day View"
        subtitle="Dispatch calendar"
        actions={
          <div className="flex gap-2">
            {canCreate && (
              <Link
                href="/scheduling/jobs/new"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
              >
                + New Job
              </Link>
            )}
          </div>
        }
      />
      <DispatchCalendar
        allJobs={jobsResult.data || []}
        jobTypes={typesResult.data || []}
        engineers={engineersResult.data || []}
        initialDate={today}
        canEdit={canEdit}
      />
    </div>
  )
}
