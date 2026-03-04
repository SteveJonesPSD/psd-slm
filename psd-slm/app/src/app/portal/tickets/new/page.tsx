import { requirePortalAuth } from '@/lib/portal/auth'
import { getPortalCategories, getPortalContacts } from '@/lib/portal/actions'
import { PortalTicketForm } from './portal-ticket-form'

export default async function PortalNewTicketPage() {
  const contact = await requirePortalAuth()
  const [categories, contacts] = await Promise.all([
    getPortalCategories(),
    contact.is_overseer ? getPortalContacts() : Promise.resolve([]),
  ])

  return (
    <PortalTicketForm
      contact={contact}
      categories={categories}
      companyContacts={contacts}
    />
  )
}
