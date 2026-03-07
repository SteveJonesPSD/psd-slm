'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, JOB_STATUS_CONFIG, JOB_PRIORITY_CONFIG } from '@/components/ui/badge'


const ANNUAL_LEAVE_QUIPS = [
  "Beach mode activated. Do not disturb.",
  "Gone fishing. Back when the tan fades.",
  "Currently out of office and out of excuses.",
  "Recharging batteries. Normal service will resume shortly.",
  "Away from keyboard, close to cocktail.",
  "On leave — the emails can wait.",
  "Off the grid. Living the dream.",
  "Somewhere sunny, doing absolutely nothing.",
  "Rest day achieved. Productivity loading...",
  "Currently unavailable. Blame the holiday gods.",
]

function getQuip(dateStr: string): string {
  // Deterministic pick based on date so it's consistent per day
  const num = dateStr.split('-').reduce((acc, n) => acc + parseInt(n), 0)
  return ANNUAL_LEAVE_QUIPS[num % ANNUAL_LEAVE_QUIPS.length]
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MobileScheduleView({ jobs, activities, today, canCreate, workingDays = [1, 2, 3, 4, 5] }: { jobs: any[]; activities: any[]; today: string; canCreate: boolean; workingDays?: number[] }) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(today)

  // Build list of working dates for the next 2 weeks
  const dates = useMemo(() => {
    const result: { date: string; label: string; dayName: string; isToday: boolean }[] = []
    const start = new Date(today + 'T12:00:00')
    for (let i = 0; i < 14; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      // Filter to working days only (1=Mon ... 7=Sun)
      const jsDay = d.getDay()
      const isoDay = jsDay === 0 ? 7 : jsDay
      if (!workingDays.includes(isoDay)) continue
      const dateStr = formatDateStr(d)
      result.push({
        date: dateStr,
        label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        isToday: dateStr === today,
      })
    }
    return result
  }, [today, workingDays])

  // Filter jobs & activities for the selected date
  const dayJobs = useMemo(() => jobs.filter(j => j.scheduled_date === selectedDate), [jobs, selectedDate])
  const dayActivities = useMemo(() => activities.filter((a: { scheduled_date: string }) => a.scheduled_date === selectedDate), [activities, selectedDate])

  // Status counts for the selected day (jobs only)
  const counts = {
    scheduled: dayJobs.filter(j => j.status === 'scheduled').length,
    travelling: dayJobs.filter(j => j.status === 'travelling' || j.status === 'return_travelling').length,
    on_site: dayJobs.filter(j => j.status === 'on_site').length,
    completed: dayJobs.filter(j => j.status === 'completed' || j.status === 'closed').length,
  }

  const selectedDateObj = new Date(selectedDate + 'T12:00:00')
  const formattedDate = selectedDateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const hasItems = dayJobs.length > 0 || dayActivities.length > 0

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Schedule</h1>
          <p className="text-sm text-slate-500">{formattedDate}</p>
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

      {/* Date scroller */}
      <div className="mb-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-1.5 pb-1">
          {dates.map(d => {
            const isSelected = d.date === selectedDate
            const dayJobCount = jobs.filter(j => j.scheduled_date === d.date).length
            const dayActCount = activities.filter((a: { scheduled_date: string }) => a.scheduled_date === d.date).length
            const hasContent = dayJobCount > 0 || dayActCount > 0
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={`flex flex-col items-center rounded-xl px-3 py-2 min-w-[52px] transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md'
                    : d.isToday
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-white border border-gray-200 text-slate-600'
                }`}
              >
                <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {d.dayName}
                </span>
                <span className="text-sm font-bold">{d.label.split(' ')[0]}</span>
                <span className={`text-[9px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {d.label.split(' ')[1]}
                </span>
                {hasContent && !isSelected && (
                  <div className="mt-0.5 h-1 w-1 rounded-full bg-indigo-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Status summary pills (jobs only, for selected day) */}
      {dayJobs.length > 0 && (
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
      )}

      {/* Activity cards */}
      {dayActivities.length > 0 && (
        <div className="space-y-3 mb-3">
          {dayActivities.map((act: { id: string; title: string; all_day: boolean; scheduled_time: string | null; duration_minutes: number; notes: string | null; activity_type: { name: string; slug: string; color: string; background: string } | null }) => {
            const at = act.activity_type
            const color = at?.color || '#6b7280'
            const bg = at?.background || '#f3f4f6'
            const isAnnualLeave = at?.slug === 'annual-leave' || at?.slug === 'leave-holiday' || at?.name?.toLowerCase().includes('leave') || at?.name?.toLowerCase().includes('holiday')

            let timeLabel = ''
            if (act.all_day) {
              timeLabel = 'All day'
            } else if (act.scheduled_time) {
              const [hours, minutes] = act.scheduled_time.split(':').map(Number)
              const endMin = hours * 60 + minutes + (act.duration_minutes || 60)
              const endH = Math.floor(endMin / 60)
              const endM = endMin % 60
              timeLabel = `${act.scheduled_time.substring(0, 5)} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
            }

            return (
              <div
                key={act.id}
                className="rounded-xl border-2 border-dashed p-4"
                style={{ borderColor: color, backgroundColor: bg }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm" style={{ color }}>&#9632;</span>
                  <span className="text-sm font-semibold" style={{ color }}>{act.title}</span>
                </div>
                {timeLabel && (
                  <p className="text-xs font-medium mb-1" style={{ color }}>{timeLabel}</p>
                )}
                {act.notes && (
                  <p className="text-xs text-slate-500 mt-1">{act.notes}</p>
                )}
                {isAnnualLeave && (
                  <p className="mt-2 text-xs italic text-slate-400">
                    {getQuip(selectedDate)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Job cards */}
      {dayJobs.length > 0 ? (
        <div className="space-y-3">
          {dayJobs.map((job: { id: string; title: string; status: string; priority: string; scheduled_time: string | null; estimated_duration_minutes: number; site_address_line1: string | null; site_city: string | null; site_postcode: string | null; job_type: { name: string; color: string; background: string } | null; company: { name: string; phone: string | null } | null; contact: { first_name: string; last_name: string; phone: string | null; email: string | null; mobile: string | null } | null; _hasSo?: boolean; _collectionStatus?: 'none' | 'pending' | 'collected'; _soNumbers?: string[] }) => {
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
            const stockBorderColor = !job._hasSo
              ? '#2563eb'
              : job._collectionStatus === 'collected'
                ? '#22c55e'
                : '#ef4444'

            return (
              <div
                key={job.id}
                onClick={() => router.push(`/scheduling/jobs/${job.id}`)}
                style={{ borderLeftColor: stockBorderColor }}
                className="block rounded-xl border border-gray-200 bg-white p-4 border-l-4 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer dark:bg-slate-800 dark:border-slate-700"
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
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{job.title}</p>
                  {job._hasSo && (
                    <span
                      title={job._collectionStatus === 'collected' ? `Stock collected${(job._soNumbers?.length ? ` — ${job._soNumbers.join(', ')}` : '')}` : `Stock not yet collected${(job._soNumbers?.length ? ` — ${job._soNumbers.join(', ')}` : '')}`}
                      className={`shrink-0 mt-0.5 ${job._collectionStatus !== 'collected' ? 'animate-pulse' : ''}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={job._collectionStatus === 'collected' ? '#22c55e' : '#ef4444'} className="w-5 h-5 drop-shadow-sm">
                        <path d="M.41 4.44A1.5 1.5 0 0 1 1.5 3h17a1.5 1.5 0 0 1 1.09.44l.01.01A1.5 1.5 0 0 1 20 4.5V6a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V4.5c0-.38.14-.74.41-1.01v-.05ZM1 8.5h18v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 1 15.5v-7Zm7 2a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5H8Z" />
                      </svg>
                    </span>
                  )}
                </div>
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

                {/* Contact & phone */}
                {(() => {
                  const phoneNumber = contact?.mobile || contact?.phone || company?.phone
                  return (
                    <div className="mt-2 space-y-1">
                      {contact && (
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{contact.first_name} {contact.last_name}</span>
                        </div>
                      )}
                      {phoneNumber && (
                        <a
                          href={`tel:${phoneNumber}`}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 no-underline"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {phoneNumber}
                        </a>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      ) : dayActivities.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-slate-500">
            {selectedDate === today ? 'No jobs scheduled for today' : 'Nothing scheduled'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {selectedDate === today ? 'Check the dispatch calendar for upcoming jobs' : 'Scroll to another day or check the dispatch calendar'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
