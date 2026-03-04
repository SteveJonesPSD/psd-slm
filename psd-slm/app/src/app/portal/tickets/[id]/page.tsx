import { notFound } from 'next/navigation'
import { requirePortalAuth } from '@/lib/portal/auth'
import { getPortalTicket } from '@/lib/portal/actions'
import { PortalTicketDetail } from './portal-ticket-detail'

export default async function PortalTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await requirePortalAuth()
  const ticket = await getPortalTicket(id)

  if (!ticket) notFound()

  return <PortalTicketDetail ticket={ticket} contact={contact} />
}
