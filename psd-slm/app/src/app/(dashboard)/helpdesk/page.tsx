import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { MobileDetector } from '@/components/ui/mobile-detector'
import { getTickets, getTeamMembers, getCategories, getBrandsForSelect, getPendingDraftsForQueue, getTicketTagMap, triggerAutoClose, getQueuePresence } from './actions'
import { TicketQueue } from './ticket-queue'
import { MobileTicketQueue } from './mobile-ticket-queue'

export default async function HelpdeskPage({ searchParams }: { searchParams: Promise<{ tags?: string; frustrated?: string }> }) {
  const params = await searchParams
  const selectedTagIds = params.tags?.split(',').filter(Boolean) || []
  const initialFrustrated = params.frustrated === 'true'

  // Fire-and-forget: process auto-close on stale tickets
  triggerAutoClose()

  const [ticketsResult, teamMembers, catResult, brands, draftsResult, tagMapResult, presenceMap] = await Promise.all([
    getTickets(),
    getTeamMembers(),
    getCategories(),
    getBrandsForSelect(),
    getPendingDraftsForQueue(),
    getTicketTagMap(),
    getQueuePresence(),
  ])

  const tickets = ticketsResult.data || []
  const tagMap = tagMapResult.data || {}
  const activeCategories = (catResult.data || []).filter((c: { is_active: boolean }) => c.is_active)
  const pendingDrafts = draftsResult.data || []

  // Stats (before tag filtering — show overall counts)
  const openCount = tickets.filter(t => !['closed', 'cancelled', 'resolved'].includes(t.status)).length
  const unassigned = tickets.filter(t => !t.assigned_to && !['closed', 'cancelled', 'resolved'].includes(t.status)).length
  const breached = tickets.filter(t => {
    if (['closed', 'cancelled'].includes(t.status)) return false
    if (t.sla_resolution_due_at && new Date(t.sla_resolution_due_at) < new Date() && !t.resolved_at) return true
    if (t.sla_response_due_at && new Date(t.sla_response_due_at) < new Date() && !t.first_responded_at) return true
    return false
  }).length
  const newCount = tickets.filter(t => t.status === 'new').length

  const stats = { openCount, unassigned, newCount, breached }

  return (
    <MobileDetector
      desktop={
        <div>
          <PageHeader
            title="Service Desk"
            subtitle="Ticket management and support queue"
          />

          <div className="mb-10 flex gap-4">
            <StatCard label="Open Tickets" value={openCount} accent="#2563eb" />
            <StatCard label="Unassigned" value={unassigned} accent={unassigned > 0 ? '#d97706' : '#1e293b'} />
            <StatCard label="New" value={newCount} accent="#6366f1" />
            <StatCard label="SLA Breached" value={breached} accent={breached > 0 ? '#dc2626' : '#059669'} />
          </div>

          <TicketQueue
            initialData={tickets}
            teamMembers={teamMembers}
            categories={activeCategories}
            brands={brands}
            pendingDrafts={pendingDrafts}
            ticketTagMap={tagMap}
            selectedTagIds={selectedTagIds}
            initialPresence={presenceMap}
            initialFrustrated={initialFrustrated}
          />
        </div>
      }
      mobile={
        <MobileTicketQueue
          initialData={tickets}
          teamMembers={teamMembers}
          categories={activeCategories}
          brands={brands}
          pendingDrafts={pendingDrafts}
          ticketTagMap={tagMap}
          selectedTagIds={selectedTagIds}
          stats={stats}
        />
      }
    />
  )
}
