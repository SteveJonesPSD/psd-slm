import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { getFieldEngineers } from '../actions'
import { WeekReview } from './week-review'

export default async function ReviewPage() {
  const engineers = await getFieldEngineers()

  return (
    <div>
      <PageHeader
        title="Visit Review"
        subtitle="Review and confirm upcoming visits"
        actions={
          <Link href="/visit-scheduling">
            <Button size="sm">← Back</Button>
          </Link>
        }
      />
      <WeekReview engineers={engineers} />
    </div>
  )
}
