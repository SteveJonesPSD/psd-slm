import { requirePortalSession } from '@/lib/portal/session'
import { getPortalOnsiteJobItems, getNextVisitForPortal, getPortalOpenOjiCount, checkCustomerOnsiteContract } from '@/lib/portal/onsite-job-actions'
import { PortalOnsiteJobsList } from './portal-onsite-jobs-list'

export default async function PortalOnsiteJobsPage() {
  const ctx = await requirePortalSession()

  const [items, nextVisit, openCount, hasOnsiteContract] = await Promise.all([
    getPortalOnsiteJobItems(ctx),
    getNextVisitForPortal(ctx),
    getPortalOpenOjiCount(ctx),
    checkCustomerOnsiteContract(ctx),
  ])

  return (
    <PortalOnsiteJobsList
      items={items}
      nextVisit={nextVisit}
      openCount={openCount}
      hasOnsiteContract={hasOnsiteContract}
      portalUserId={ctx.portalUserId}
    />
  )
}
