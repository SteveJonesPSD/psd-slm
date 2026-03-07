import { redirect } from 'next/navigation'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalGroup, getPortalMemberStats } from '@/lib/portal/group-actions'
import { GROUP_TYPE_LABELS } from '@/types/company-groups'
import { GroupDashboardClient } from './group-dashboard-client'

export default async function PortalGroupPage() {
  const ctx = await requirePortalSession()

  if (!ctx.isGroupAdmin) redirect('/portal/dashboard')

  const group = await getPortalGroup(ctx.customerId, ctx.orgId)
  if (!group) redirect('/portal/dashboard')

  // Fetch stats for all members + parent
  const allCompanyIds = [
    group.parent_company_id,
    ...(group.members || []).map(m => m.company_id),
  ]

  const statsMap: Record<string, { openTickets: number; activeContracts: number; openQuotes: number }> = {}
  await Promise.all(
    allCompanyIds.map(async (cid) => {
      statsMap[cid] = await getPortalMemberStats(cid, ctx.orgId)
    })
  )

  return (
    <GroupDashboardClient
      group={group}
      statsMap={statsMap}
      parentCompanyName={ctx.customerName}
    />
  )
}
