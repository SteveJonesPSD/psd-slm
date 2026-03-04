import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { getCalendars, getFieldEngineers } from '../actions'
import { GenerateForm } from './generate-form'

export default async function GeneratePage() {
  const [calendars, engineers] = await Promise.all([
    getCalendars(),
    getFieldEngineers(),
  ])

  // Only show draft or active calendars for generation
  const availableCalendars = calendars.filter(c => c.status !== 'archived')

  return (
    <div>
      <PageHeader
        title="Generate Visits"
        subtitle="Create visit diary entries from contract visit slots"
        actions={
          <Link
            href="/visit-scheduling"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50 transition-colors"
          >
            ← Back
          </Link>
        }
      />
      <GenerateForm calendars={availableCalendars} engineers={engineers} />
    </div>
  )
}
