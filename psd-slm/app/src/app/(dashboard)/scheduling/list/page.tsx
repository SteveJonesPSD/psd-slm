import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
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
          <div className="flex items-center gap-2">
            <Link href="/scheduling">
              <Button size="sm">Calendar</Button>
            </Link>
            {canCreate && (
              <Link href="/scheduling/jobs/new">
                <Button size="sm" variant="primary">+ New Job</Button>
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
