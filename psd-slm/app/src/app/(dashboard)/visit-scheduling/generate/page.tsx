import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
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
          <Link href="/visit-scheduling">
            <Button size="sm">← Back</Button>
          </Link>
        }
      />
      <GenerateForm calendars={availableCalendars} engineers={engineers} />
    </div>
  )
}
