import { notFound } from 'next/navigation'
import { MobileDetector } from '@/components/ui/mobile-detector'
import { requireAuth } from '@/lib/auth'
import { getTicket, getTeamMembers, getCategories, getTags, getCannedResponses, getDraftResponses, getDepartments, getScratchpadNotes, getAssistHistory, getMergedTickets, getMergedMessages, getMergeRecordForSource } from '../../actions'
import { TicketDetail } from './ticket-detail'
import { MobileTicketDetail } from './mobile-ticket-detail'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentUser = await requireAuth()

  const [ticketResult, teamMembers, catResult, tagResult, cannedResult, draftResult, deptResult, scratchpadResult, assistHistoryResult, mergedTicketsResult, mergedMessagesResult, mergeRecordResult] = await Promise.all([
    getTicket(id),
    getTeamMembers(),
    getCategories(),
    getTags(),
    getCannedResponses(),
    getDraftResponses(id),
    getDepartments(),
    getScratchpadNotes(id),
    getAssistHistory(id),
    getMergedTickets(id),
    getMergedMessages(id),
    getMergeRecordForSource(id),
  ])

  if (ticketResult.error || !ticketResult.data) return notFound()

  const activeDepartments = (deptResult.data || [])
    .filter(d => d.is_active)
    .map(d => ({ id: d.id, name: d.name, escalation_type: d.escalation_type, priority_uplift: d.priority_uplift }))

  const activeCategories = (catResult.data || []).filter((c: { is_active: boolean }) => c.is_active)
  const activeTags = (tagResult.data || []).filter((t: { is_active: boolean }) => t.is_active)
  const cannedResponses = cannedResult.data || []
  const drafts = draftResult.data || []
  const scratchpadNotes = scratchpadResult.data || []
  const assistHistory = assistHistoryResult.data || []
  const mergedTickets = mergedTicketsResult.data || []
  const mergedMessages = mergedMessagesResult.data || []
  const mergeRecordId = mergeRecordResult.data?.id || null

  return (
    <MobileDetector
      desktop={
        <TicketDetail
          ticket={ticketResult.data}
          teamMembers={teamMembers}
          categories={activeCategories}
          tags={activeTags}
          cannedResponses={cannedResponses}
          drafts={drafts}
          departments={activeDepartments}
          scratchpadNotes={scratchpadNotes}
          assistHistory={assistHistory}
          mergedTickets={mergedTickets}
          mergedMessages={mergedMessages}
          mergeRecordId={mergeRecordId}
          currentUserId={currentUser.id}
        />
      }
      mobile={
        <MobileTicketDetail
          ticket={ticketResult.data}
          teamMembers={teamMembers}
          categories={activeCategories}
          tags={activeTags}
          cannedResponses={cannedResponses}
          drafts={drafts}
          departments={activeDepartments}
          scratchpadNotes={scratchpadNotes}
          mergedTickets={mergedTickets}
          mergedMessages={mergedMessages}
          mergeRecordId={mergeRecordId}
          currentUserId={currentUser.id}
        />
      }
    />
  )
}
