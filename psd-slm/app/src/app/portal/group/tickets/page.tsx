import { redirect } from 'next/navigation'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalGroup, getPortalGroupTickets } from '@/lib/portal/group-actions'
import { GroupTicketsClient } from './group-tickets-client'

export default async function PortalGroupTicketsPage() {
  const ctx = await requirePortalSession()

  if (!ctx.isGroupAdmin) redirect('/portal/dashboard')

  const group = await getPortalGroup(ctx.customerId, ctx.orgId)
  if (!group) redirect('/portal/dashboard')

  // All company IDs: parent + members
  const allCompanyIds = [
    group.parent_company_id,
    ...(group.members || []).map(m => m.company_id),
  ]

  const tickets = await getPortalGroupTickets(allCompanyIds, ctx.orgId)

  // Build colour map: companyId → colour
  const colourMap: Record<string, string> = {
    [group.parent_company_id]: '#7c3aed',
  }
  for (const m of group.members || []) {
    colourMap[m.company_id] = m.colour
  }

  // Build name map
  const nameMap: Record<string, string> = {
    [group.parent_company_id]: group.parent_company?.name || 'Parent',
  }
  for (const m of group.members || []) {
    nameMap[m.company_id] = m.company?.name || 'Unknown'
  }

  return (
    <GroupTicketsClient
      tickets={tickets}
      colourMap={colourMap}
      nameMap={nameMap}
      groupName={group.name}
    />
  )
}
