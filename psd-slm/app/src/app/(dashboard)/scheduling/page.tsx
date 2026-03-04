import { Suspense } from 'react'
import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getJobs, getEngineers, getMyTodayJobs } from './actions'
import { WeekView } from './week/week-view'
import { MobileDetector } from '@/components/ui/mobile-detector'
import { MobileScheduleView } from './mobile-schedule-view'
import Link from 'next/link'

export default async function SchedulingPage() {
  const user = await requirePermission('scheduling', 'view')
  const canCreate = user.permissions.includes('scheduling.create')
  const canEdit = user.permissions.includes('scheduling.edit')
  const isAdmin = user.permissions.includes('scheduling.admin')

  const [jobsResult, engineersResult, todayResult] = await Promise.all([
    getJobs(),
    getEngineers(),
    getMyTodayJobs(),
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
          <div className="flex gap-2">
            {isAdmin && (
              <Link
                href="/scheduling/config/job-types"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 no-underline"
                title="Scheduling Configuration"
              >
                <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            )}
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

  const mobile = (
    <MobileScheduleView
      jobs={todayResult.data || []}
      canCreate={canCreate}
    />
  )

  return <MobileDetector desktop={desktop} mobile={mobile} />
}
