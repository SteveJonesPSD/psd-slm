'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, TICKET_TYPE_CONFIG } from '@/components/ui/badge'
import { ConversationThread } from './conversation-thread'
import { ReplyBox } from './reply-box'
import { DraftResponseBanner } from './draft-response-banner'
import type { TicketContext } from './ai-suggest-modal'
import { HelenAssistModal } from './helen-assist-panel'
import type { TicketContextForAssist } from './helen-assist-panel'
import { MetadataSidebar } from './metadata-sidebar'
import { SlaPanel } from './sla-panel'
import { TimeEntries } from './time-entries'
import { MediaSection } from './media-section'
import { ScratchpadPanel } from './scratchpad-panel'
import { EscalationSection } from './escalation-section'
import { WatchersSection } from './watchers-section'
import { MergedBanner } from './merged-banner'
import { MergedTicketsSection } from './merged-tickets-section'
import { MergeTicketModal } from './merge-ticket-modal'
import { useTicketPresence } from './use-ticket-presence'
import { PresenceBanner } from './presence-banner'
import { AutogrumpBanner } from '@/components/helpdesk/autogrump-badge'
import { EmailThreadSection } from './email-thread-section'
import type { TicketEmail } from '@/lib/email/types'
import type { HelenDraftType } from '@/types/database'

interface DepartmentOption {
  id: string
  name: string
  escalation_type: string
  priority_uplift: number
}

interface TicketDetailProps {
  ticket: Record<string, unknown>
  teamMembers: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null }[]
  categories: { id: string; name: string; parent_id: string | null }[]
  tags: { id: string; name: string; color: string }[]
  cannedResponses: { id: string; title: string; body: string; category: string | null }[]
  drafts: { id: string; draft_type: HelenDraftType; body: string; status: string; ai_reasoning: string | null }[]
  departments: DepartmentOption[]
  scratchpadNotes: Record<string, unknown>[]
  assistHistory: { id: string; response_body: string | null; created_at: string }[]
  mergedTickets: Record<string, unknown>[]
  mergedMessages: Record<string, unknown>[]
  mergeRecordId: string | null
  currentUserId: string
  helenAvatarUrl?: string | null
  ticketEmails?: TicketEmail[]
  emailContext?: { hasEmailContext: boolean; recipientAddress?: string; recipientName?: string | null; channelId?: string }
}

export function TicketDetail({ ticket, teamMembers, categories, tags, cannedResponses, drafts, departments, scratchpadNotes, assistHistory, mergedTickets, mergedMessages, mergeRecordId, currentUserId, helenAvatarUrl, ticketEmails, emailContext }: TicketDetailProps) {
  const t = ticket as Record<string, unknown>
  const statusCfg = TICKET_STATUS_CONFIG[t.status as string]
  const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority as string]
  const typeCfg = TICKET_TYPE_CONFIG[t.ticket_type as string]

  const customer = t.customers as Record<string, unknown> | null
  const contact = t.contacts as Record<string, unknown> | null
  const assignee = t.assignee as Record<string, unknown> | null
  const category = t.ticket_categories as Record<string, unknown> | null
  const msgs = (t.messages as Record<string, unknown>[]) || []

  // Resolve department name from id
  const currentDepartment = t.department_id
    ? departments.find(d => d.id === t.department_id) || null
    : null

  const viewers = useTicketPresence(t.id as string)
  const [showAssistModal, setShowAssistModal] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const composeRef = useRef<((text: string) => void) | null>(null)

  const isMergedSource = Boolean(t.merged_into_ticket_id)
  const canMerge = !isMergedSource && t.status !== 'cancelled' && t.status !== 'closed'

  // Combine this ticket's messages with merged source messages, sorted chronologically
  const allMessages = (() => {
    const own = (t.messages as Record<string, unknown>[]) || []
    if (!mergedMessages || mergedMessages.length === 0) return own
    const combined = [...own, ...mergedMessages]
    combined.sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime())
    return combined
  })()

  const ticketContext: TicketContext = {
    ticketNumber: t.ticket_number as string,
    subject: t.subject as string,
    description: (t.description as string) || null,
    customerName: (customer?.name as string) || 'Unknown',
    contactName: contact ? `${contact.first_name} ${contact.last_name}` : null,
    status: t.status as string,
    priority: t.priority as string,
    ticketType: t.ticket_type as string,
    category: (category?.name as string) || null,
    slaResponseDue: (t.sla_response_due as string) || null,
    slaResolutionDue: (t.sla_resolution_due as string) || null,
    assigneeName: assignee ? `${assignee.first_name} ${assignee.last_name}` : null,
    messages: msgs.map((m) => {
      const sender = m.sender as Record<string, unknown> | null
      return {
        senderType: m.sender_type as 'agent' | 'customer' | 'system',
        senderName: sender ? `${sender.first_name} ${sender.last_name}` : null,
        body: m.body as string,
        isInternal: m.is_internal as boolean,
        createdAt: m.created_at as string,
      }
    }),
  }

  const assistContext: TicketContextForAssist = {
    ...ticketContext,
    categoryId: (category?.id as string) || null,
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/helpdesk" className="text-sm text-slate-400 hover:text-slate-600 no-underline">
              Helpdesk
            </Link>
            <span className="text-slate-300">/</span>
            <h2 className="text-xl font-bold text-slate-900">{t.ticket_number as string}</h2>
            {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
            {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
            {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
            {t.source === 'email' && <Badge label="Email" color="#2563eb" bg="#eff6ff" />}
            {Boolean(t.hold_open) && <Badge label="Hold Open" color="#b45309" bg="#fef3c7" />}
          </div>
          {(t.tone_score as number | null) && (t.tone_score as number) >= 3 && (
            <div className="mt-2">
              <AutogrumpBanner
                toneScore={t.tone_score as number | null}
                toneTrend={t.tone_trend as string | null}
                toneSummary={t.tone_summary as string | null}
              />
            </div>
          )}
          <h3 className="mt-1 text-lg text-slate-700">{t.subject as string}</h3>
          <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
            <span>{(t.customers as Record<string, unknown>)?.name as string || <span className="text-red-500 font-medium">Unmatched sender — assign customer</span>}</span>
            {t.contacts ? (
              <span>
                Contact: {(t.contacts as Record<string, unknown>).first_name as string} {(t.contacts as Record<string, unknown>).last_name as string}
              </span>
            ) : null}
            <span>Created {new Date(t.created_at as string).toLocaleString('en-GB')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canMerge && (
            <button
              onClick={() => setShowMergeModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              Merge
            </button>
          )}
          {!isMergedSource && (
            <button
              onClick={() => setShowAssistModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              Help me Fix This
            </button>
          )}
        </div>
      </div>

      <PresenceBanner viewers={viewers} />

      {isMergedSource && t.merge_target ? (
        <MergedBanner
          targetTicketId={(t.merge_target as Record<string, unknown>).id as string}
          targetTicketNumber={(t.merge_target as Record<string, unknown>).ticket_number as string}
          mergeId={mergeRecordId}
        />
      ) : null}

      {/* Main content: 70% / 30% split */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Conversation + Reply */}
        <div className="flex-1 min-w-0 space-y-4">
          <ConversationThread messages={allMessages} helenAvatarUrl={helenAvatarUrl} />
          {!isMergedSource && (
            <>
              <DraftResponseBanner drafts={drafts} ticketId={t.id as string} />
              <ReplyBox
                ticketId={t.id as string}
                ticketStatus={t.status as string}
                cannedResponses={cannedResponses}
                ticketContext={ticketContext}
                composeRef={composeRef}
                viewers={viewers}
                emailContext={emailContext}
              />
            </>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-4">
          <MetadataSidebar
            ticket={t}
            teamMembers={teamMembers}
            categories={categories}
            tags={tags}
            currentTags={(t.tags as Record<string, unknown>[]) || []}
            departmentName={currentDepartment?.name || null}
          />
          <SlaPanel ticket={t} />
          <TimeEntries
            ticketId={t.id as string}
            entries={(t.time_entries as Record<string, unknown>[]) || []}
          />
          <MediaSection
            ticketId={t.id as string}
            attachments={(t.attachments as Record<string, unknown>[]) || []}
          />
          {ticketEmails && ticketEmails.length > 0 && (
            <EmailThreadSection emails={ticketEmails} />
          )}
          <ScratchpadPanel
            ticketId={t.id as string}
            notes={scratchpadNotes}
            currentUserId={currentUserId}
          />
          <EscalationSection
            ticketId={t.id as string}
            escalationLevel={t.escalation_level as number}
            currentDepartment={currentDepartment ? { id: currentDepartment.id, name: currentDepartment.name } : null}
            teamMembers={teamMembers}
            departments={departments}
          />
          <MergedTicketsSection mergedTickets={mergedTickets as never[]} />
          <WatchersSection
            ticketId={t.id as string}
            watchers={(t.watchers as Record<string, unknown>[]) || []}
            teamMembers={teamMembers}
          />
        </div>
      </div>

      {showAssistModal && (
        <HelenAssistModal
          ticketId={t.id as string}
          ticketContext={assistContext}
          assistHistory={assistHistory}
          onClose={() => setShowAssistModal(false)}
          onComposeReply={(text) => {
            composeRef.current?.(text)
            setShowAssistModal(false)
          }}
        />
      )}

      {showMergeModal && (
        <MergeTicketModal
          ticketId={t.id as string}
          ticketNumber={t.ticket_number as string}
          customerId={(customer?.id as string) || (t.customer_id as string)}
          onClose={() => setShowMergeModal(false)}
        />
      )}
    </div>
  )
}
