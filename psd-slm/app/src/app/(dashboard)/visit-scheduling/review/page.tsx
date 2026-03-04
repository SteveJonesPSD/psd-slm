import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
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
          <Link
            href="/visit-scheduling"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50 transition-colors"
          >
            ← Back
          </Link>
        }
      />
      <WeekReview engineers={engineers} />
    </div>
  )
}
