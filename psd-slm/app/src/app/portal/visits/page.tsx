import { requirePortalSession } from '@/lib/portal/session'
import { getPortalVisits } from '@/lib/portal/visits-actions'
import { PortalVisitsGrid } from './portal-visits-grid'

export default async function PortalVisitsPage() {
  const ctx = await requirePortalSession()
  const visits = await getPortalVisits(ctx)

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scheduled Visits</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">View upcoming and past site visits</p>
      </div>

      <PortalVisitsGrid visits={visits} />
    </div>
  )
}
