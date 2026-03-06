import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
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
          <Link href="/visit-scheduling/calendars/new">
            <Button size="sm" variant="primary">+ New Calendar</Button>
          </Link>
        }
      />
      <CalendarsTable calendars={calendars} />
    </div>
  )
}
