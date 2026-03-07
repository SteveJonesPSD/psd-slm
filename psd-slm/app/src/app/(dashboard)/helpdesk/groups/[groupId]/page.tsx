import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { getCompanyGroup, getGroupMemberIds } from '@/lib/company-groups/actions'
import { GroupTicketsView } from './group-tickets-view'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ groupId: string }>
}

export default async function InternalGroupTicketsPage({ params }: PageProps) {
  const { groupId } = await params
  await requirePermission('helpdesk', 'view')

  const group = await getCompanyGroup(groupId)
  if (!group) notFound()

  const supabase = await createClient()

  // All company IDs: parent + members
  const allCompanyIds = [
    group.parent_company_id,
    ...(group.members || []).map(m => m.company_id),
  ]

  // Fetch tickets for all companies
  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      id, ticket_number, subject, status, priority, created_at, updated_at,
      customer_id, customers(name),
      users!tickets_assigned_to_fkey(first_name, last_name, initials, color)
    `)
    .in('customer_id', allCompanyIds)
    .order('updated_at', { ascending: false })
    .limit(500)

  const ticketRows = (tickets || []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    ticket_number: t.ticket_number as string,
    subject: t.subject as string,
    status: t.status as string,
    priority: t.priority as string,
    created_at: t.created_at as string,
    updated_at: t.updated_at as string,
    customer_id: t.customer_id as string,
    customer_name: (t.customers as { name: string } | null)?.name || '',
    assigned_to: t.users as { first_name: string; last_name: string; initials: string | null; color: string | null } | null,
  }))

  // Build colour map
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
    <div>
      <Link
        href={`/customers/${group.parent_company_id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6"
      >
        &larr; Back to {group.parent_company?.name}
      </Link>

      <GroupTicketsView
        tickets={ticketRows}
        colourMap={colourMap}
        nameMap={nameMap}
        groupName={group.name}
        totalCount={ticketRows.length}
      />
    </div>
  )
}
