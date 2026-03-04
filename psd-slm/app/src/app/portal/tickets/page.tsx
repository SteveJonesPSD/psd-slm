import { requirePortalAuth } from '@/lib/portal/auth'
import { getPortalTickets, getPortalContacts } from '@/lib/portal/actions'
import { PortalTicketList } from './portal-ticket-list'

export default async function PortalTicketsPage() {
  const contact = await requirePortalAuth()
  const [tickets, contacts] = await Promise.all([
    getPortalTickets(),
    contact.is_overseer ? getPortalContacts() : Promise.resolve([]),
  ])

  return (
    <PortalTicketList
      tickets={tickets as never[]}
      contact={contact}
      companyContacts={contacts}
    />
  )
}
