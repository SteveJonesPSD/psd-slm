import { Suspense } from 'react'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { getJobs, getEngineers } from '../actions'
import { WeekView } from './week-view'
import Link from 'next/link'

export default async function WeekViewPage() {
  const user = await requirePermission('scheduling', 'view')
  const canEdit = user.permissions.includes('scheduling.edit')

  const [jobsResult, engineersResult] = await Promise.all([
    getJobs(),
    getEngineers(),
  ])

  // Get Monday of current week
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

  return (
    <div>
      <PageHeader
        title="Week View"
        subtitle="Weekly schedule overview"
        actions={
          <Link href="/scheduling/jobs/new">
            <Button size="sm" variant="primary">+ New Job</Button>
          </Link>
        }
      />
      <Suspense fallback={null}>
        <WeekView
          allJobs={jobsResult.data || []}
          engineers={engineersResult.data || []}
          initialWeekStart={weekStart}
          canEdit={canEdit}
        />
      </Suspense>
    </div>
  )
}
