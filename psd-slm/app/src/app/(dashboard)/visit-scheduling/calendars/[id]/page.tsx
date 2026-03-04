import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Badge, CALENDAR_STATUS_CONFIG } from '@/components/ui/badge'
import { getCalendar, getCalendarWeeks, getBankHolidays } from '../../actions'
import { getDateYear } from '@/lib/visit-scheduling/types'
import { CalendarGrid } from './calendar-grid'

export default async function CalendarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [calendar, weeks, bankHolidays] = await Promise.all([
    getCalendar(id),
    getCalendarWeeks(id),
    getBankHolidays(),
  ])

  if (!calendar) notFound()

  const statusCfg = CALENDAR_STATUS_CONFIG[calendar.status]
  const sy = getDateYear(calendar.academic_year_start)
  const ey = getDateYear(calendar.academic_year_end)
  const academicYearLabel = sy && ey ? `${sy}/${ey}` : 'Unknown Year'

  return (
    <div>
      <PageHeader
        title={calendar.name}
        subtitle={`${academicYearLabel} · ${weeks.length} weeks · ${calendar.schedule_weeks}-week schedule`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            <Link
              href="/visit-scheduling/calendars"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 no-underline hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              ← Back
            </Link>
          </div>
        }
      />
      <CalendarGrid
        calendarId={calendar.id}
        calendarStatus={calendar.status}
        weeks={weeks}
        bankHolidays={bankHolidays}
      />
    </div>
  )
}
