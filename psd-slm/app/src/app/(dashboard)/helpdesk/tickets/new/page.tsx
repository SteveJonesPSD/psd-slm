import { PageHeader } from '@/components/ui/page-header'
import { MobileDetector } from '@/components/ui/mobile-detector'
import { getCustomersForSelect, getCategories, getTags, getTeamMembers, getBrandsForSelect } from '../../actions'
import { TicketForm } from './ticket-form'
import { MobileNewTicketHeader } from './mobile-new-ticket-header'

export default async function NewTicketPage() {
  const [customers, catResult, tagResult, teamMembers, brands] = await Promise.all([
    getCustomersForSelect(),
    getCategories(),
    getTags(),
    getTeamMembers(),
    getBrandsForSelect(),
  ])

  const activeCategories = (catResult.data || []).filter((c: { is_active: boolean }) => c.is_active)
  const activeTags = (tagResult.data || []).filter((t: { is_active: boolean }) => t.is_active)

  return (
    <div>
      <MobileDetector
        desktop={<PageHeader title="New Ticket" />}
        mobile={<MobileNewTicketHeader />}
      />
      <TicketForm
        customers={customers}
        categories={activeCategories}
        tags={activeTags}
        teamMembers={teamMembers}
        brands={brands}
      />
    </div>
  )
}
