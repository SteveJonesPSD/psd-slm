import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { getCalendars } from '../actions'
import { CalendarsTable } from './calendars-table'

export default async function CalendarsPage() {
  const calendars = await getCalendars()

  return (
    <div>
      <PageHeader
        title="Visit Calendars"
        subtitle="Academic year calendars with holiday configuration"
        actions={
          <Link
            href="/visit-scheduling/calendars/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-indigo-700 transition-colors"
          >
            + New Calendar
          </Link>
        }
      />
      <CalendarsTable calendars={calendars} />
    </div>
  )
}
