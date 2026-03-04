import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { NewCalendarForm } from './new-calendar-form'

export default function NewCalendarPage() {
  return (
    <div>
      <PageHeader
        title="New Calendar"
        subtitle="Create an academic year calendar"
        actions={
          <Link
            href="/visit-scheduling/calendars"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50 transition-colors"
          >
            ← Back
          </Link>
        }
      />
      <NewCalendarForm />
    </div>
  )
}
