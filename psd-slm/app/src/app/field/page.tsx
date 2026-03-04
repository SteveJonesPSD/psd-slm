import { requireAuth } from '@/lib/auth'
import { getMyTodayJobs } from '@/app/(dashboard)/scheduling/actions'
import { TodayJobs } from './today-jobs'

export default async function FieldPage() {
  const user = await requireAuth()
  const result = await getMyTodayJobs()

  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Today</h1>
        <p className="text-sm text-slate-500">{dateLabel}</p>
      </div>
      <TodayJobs jobs={result.data || []} />
    </div>
  )
}
