'use client'

import Link from 'next/link'
import { Badge, JOB_STATUS_CONFIG, JOB_PRIORITY_CONFIG } from '@/components/ui/badge'

const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-amber-500',
  normal: 'border-l-indigo-400',
  low: 'border-l-slate-300',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MobileScheduleView({ jobs, canCreate }: { jobs: any[]; canCreate: boolean }) {
  const today = new Date()
  const formatted = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  // Status counts
  const counts = {
    scheduled: jobs.filter(j => j.status === 'scheduled').length,
    travelling: jobs.filter(j => j.status === 'travelling').length,
    on_site: jobs.filter(j => j.status === 'on_site').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Schedule</h1>
          <p className="text-sm text-slate-500">{formatted}</p>
        </div>
        {canCreate && (
          <Link
            href="/scheduling/jobs/new"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
          >
            + New Job
          </Link>
        )}
      </div>

      {/* Status summary pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {counts.scheduled > 0 && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {counts.scheduled} Scheduled
          </span>
        )}
        {counts.travelling > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            {counts.travelling} Travelling
          </span>
        )}
        {counts.on_site > 0 && (
          <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
            {counts.on_site} On Site
          </span>
        )}
        {counts.completed > 0 && (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            {counts.completed} Completed
          </span>
        )}
      </div>

      {/* Job cards */}
      {jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => {
            const statusCfg = JOB_STATUS_CONFIG[job.status] || { label: job.status, color: '#6b7280', bg: '#f3f4f6' }
            const priorityCfg = JOB_PRIORITY_CONFIG[job.priority] || { label: job.priority, color: '#6b7280', bg: '#f3f4f6' }
            const jt = job.job_type
            const company = job.company
            const contact = job.contact

            const timeStr = job.scheduled_time ? job.scheduled_time.substring(0, 5) : null
            const durationH = Math.floor(job.estimated_duration_minutes / 60)
            const durationM = job.estimated_duration_minutes % 60
            const durationStr = durationH > 0 ? `${durationH}h${durationM > 0 ? ` ${durationM}m` : ''}` : `${durationM}m`
            const endTime = timeStr && job.estimated_duration_minutes
              ? (() => {
                  const [h, m] = timeStr.split(':').map(Number)
                  const totalMin = h * 60 + m + job.estimated_duration_minutes
                  const eh = Math.floor(totalMin / 60) % 24
                  const em = totalMin % 60
                  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
                })()
              : null

            const addressParts = [job.site_address_line1, job.site_city, job.site_postcode].filter(Boolean)
            const addressSnippet = addressParts.join(', ')
            const borderClass = PRIORITY_BORDER[job.priority] || 'border-l-slate-300'

            return (
              <Link
                key={job.id}
                href={`/scheduling/jobs/${job.id}`}
                className={`block rounded-xl border border-gray-200 bg-white p-4 border-l-4 ${borderClass} no-underline hover:bg-slate-50 active:bg-slate-100 transition-colors`}
              >
                {/* Time range */}
                {timeStr && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">{timeStr}</span>
                    {endTime && (
                      <span className="text-sm text-slate-400">- {endTime}</span>
                    )}
                    <span className="text-xs text-slate-400">({durationStr})</span>
                  </div>
                )}

                {/* Title + badges */}
                <p className="text-sm font-semibold text-slate-900 mb-1.5">{job.title}</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Badge {...statusCfg} />
                  {jt && <Badge label={jt.name} color={jt.color} bg={jt.background} />}
                  <Badge {...priorityCfg} />
                </div>

                {/* Company & address */}
                {company && (
                  <p className="text-sm font-medium text-slate-700">{company.name}</p>
                )}
                {addressSnippet && (
                  <p className="text-xs text-slate-400 mt-0.5">{addressSnippet}</p>
                )}

                {/* Contact info */}
                {contact && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <span>{contact.first_name} {contact.last_name}</span>
                    {(contact.mobile || contact.phone) && (
                      <span className="text-indigo-600">{contact.mobile || contact.phone}</span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No jobs scheduled for today</p>
          <p className="mt-1 text-xs text-slate-400">Check the dispatch calendar for upcoming jobs</p>
        </div>
      )}
    </div>
  )
}
