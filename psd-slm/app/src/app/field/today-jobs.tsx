'use client'

import Link from 'next/link'
import { Badge, JOB_STATUS_CONFIG, JOB_PRIORITY_CONFIG } from '@/components/ui/badge'

const PRIORITY_BAR_COLORS: Record<string, string> = {
  low: '#6b7280',
  normal: '#2563eb',
  high: '#d97706',
  urgent: '#dc2626',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TodayJobs({ jobs }: { jobs: any[] }) {
  // Status summary
  const scheduled = jobs.filter(j => j.status === 'scheduled').length
  const onSite = jobs.filter(j => j.status === 'on_site').length
  const travelling = jobs.filter(j => j.status === 'travelling').length
  const completed = jobs.filter(j => j.status === 'completed').length

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h2 className="text-lg font-semibold text-slate-700">No jobs scheduled for today</h2>
        <p className="mt-1 text-sm text-slate-400">Enjoy the quiet!</p>
      </div>
    )
  }

  return (
    <div>
      {/* Status Summary */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
        {scheduled > 0 && (
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">{scheduled} Scheduled</span>
        )}
        {travelling > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{travelling} Travelling</span>
        )}
        {onSite > 0 && (
          <span className="rounded-full bg-purple-100 px-2.5 py-1 text-purple-700">{onSite} On Site</span>
        )}
        {completed > 0 && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">{completed} Completed</span>
        )}
      </div>

      {/* Job Cards */}
      <div className="space-y-3">
        {jobs.map(job => {
          const jt = job.job_type
          const contact = job.contact
          const statusCfg = JOB_STATUS_CONFIG[job.status] || { label: job.status, color: '#6b7280', bg: '#f3f4f6' }
          const timeStr = job.scheduled_time ? job.scheduled_time.substring(0, 5) : null
          const endMinutes = timeStr
            ? (parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]) + job.estimated_duration_minutes)
            : null
          const endStr = endMinutes
            ? `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
            : null

          return (
            <Link
              key={job.id}
              href={`/field/job/${job.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 no-underline transition-shadow hover:shadow-md active:shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: PRIORITY_BAR_COLORS[job.priority] || '#6b7280' }}
            >
              {/* Top row: time + priority */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-slate-700">
                  {timeStr ? `${timeStr}${endStr ? ` — ${endStr}` : ''}` : 'No time set'}
                </span>
                {(job.priority === 'high' || job.priority === 'urgent') && (
                  <Badge {...(JOB_PRIORITY_CONFIG[job.priority] || {})} />
                )}
              </div>

              {/* Company name */}
              <p className="text-base font-bold text-slate-900 mb-1.5">{job.company?.name}</p>

              {/* Type + Status */}
              <div className="flex items-center gap-2 mb-2">
                {jt && <Badge label={jt.name} color={jt.color} bg={jt.background} />}
                <Badge {...statusCfg} />
              </div>

              {/* Contact info */}
              {contact && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
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
    </div>
  )
}
