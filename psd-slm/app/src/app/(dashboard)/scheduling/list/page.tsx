import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getJobs, getJobTypes, getEngineers } from '../actions'
import { JobsList } from './jobs-list'
import Link from 'next/link'

export default async function JobsListPage() {
  const user = await requirePermission('scheduling', 'view')
  const canCreate = user.permissions.includes('scheduling.create')

  const [jobsResult, typesResult, engineersResult] = await Promise.all([
    getJobs(),
    getJobTypes(),
    getEngineers(),
  ])

  return (
    <div>
      <PageHeader
        title="All Jobs"
        subtitle="Full list of scheduled and unscheduled jobs"
        actions={
          <div className="flex gap-2">
            <Link
              href="/scheduling"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-gray-50 no-underline"
            >
              Calendar
            </Link>
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
      <JobsList
        jobs={jobsResult.data || []}
        jobTypes={typesResult.data || []}
        engineers={engineersResult.data || []}
      />
    </div>
  )
}
