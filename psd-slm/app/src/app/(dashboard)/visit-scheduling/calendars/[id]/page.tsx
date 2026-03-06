import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
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
          <div className="flex items-center gap-2">
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            <Link href="/visit-scheduling/calendars">
              <Button size="sm">← Back</Button>
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
