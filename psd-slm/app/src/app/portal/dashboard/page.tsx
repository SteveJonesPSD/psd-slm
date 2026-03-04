import { redirect } from 'next/navigation'
import { requirePortalAuth } from '@/lib/portal/auth'
import { getOverseerDashboard } from '@/lib/portal/actions'
import { OverseerDashboard } from './overseer-dashboard'

export default async function PortalDashboardPage() {
  const contact = await requirePortalAuth()

  if (!contact.is_overseer) {
    redirect('/portal/tickets')
  }

  const data = await getOverseerDashboard()
  if (!data) redirect('/portal/tickets')

  return <OverseerDashboard data={data} companyName={contact.customer.name} />
}
