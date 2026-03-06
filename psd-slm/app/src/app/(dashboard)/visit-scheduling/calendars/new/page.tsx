import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { NewCalendarForm } from './new-calendar-form'

export default function NewCalendarPage() {
  return (
    <div>
      <PageHeader
        title="New Calendar"
        subtitle="Create an academic year calendar"
        actions={
          <Link href="/visit-scheduling/calendars">
            <Button size="sm">← Back</Button>
          </Link>
        }
      />
      <NewCalendarForm />
    </div>
  )
}
