'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, TICKET_TYPE_CONFIG } from '@/components/ui/badge'
import { AutogrumpBadge } from '@/components/helpdesk/autogrump-badge'
import { MobileConversation } from './mobile-conversation'
import { MobileReplySheet } from './mobile-reply-sheet'
import { DraftResponseBanner } from './draft-response-banner'
import { MetadataSidebar } from './metadata-sidebar'
import { SlaPanel } from './sla-panel'
import { TimeEntries } from './time-entries'
import { MediaSection } from './media-section'
import { EscalationSection } from './escalation-section'
import { WatchersSection } from './watchers-section'
import { ScratchpadPanel } from './scratchpad-panel'
import { MergedTicketsSection } from './merged-tickets-section'
import { MergedBanner } from './merged-banner'
import { HelenAssistModal } from './helen-assist-panel'
import type { TicketContextForAssist } from './helen-assist-panel'
import { useTicketPresence } from './use-ticket-presence'
import { PresenceBanner } from './presence-banner'
import type { TicketContext } from './ai-suggest-modal'
import type { HelenDraftType } from '@/types/database'

interface DepartmentOption {
  id: string
  name: string
  escalation_type: string
  priority_uplift: number
}

interface MobileTicketDetailProps {
  ticket: Record<string, unknown>
  teamMembers: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null }[]
  categories: { id: string; name: string; parent_id: string | null }[]
  tags: { id: string; name: string; color: string }[]
  cannedResponses: { id: string; title: string; body: string; category: string | null }[]
  drafts: { id: string; draft_type: HelenDraftType; body: string; status: string; ai_reasoning: string | null }[]
  departments: DepartmentOption[]
  scratchpadNotes?: Record<string, unknown>[]
  assistHistory?: { id: string; response_body: string | null; created_at: string }[]
  mergedTickets?: Record<string, unknown>[]
  mergedMessages?: Record<string, unknown>[]
  mergeRecordId?: string | null
  currentUserId?: string
  helenAvatarUrl?: string | null
}

type Tab = 'conversation' | 'details' | 'sla' | 'more'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'conversation',
    label: 'Chat',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    key: 'details',
    label: 'Details',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
  {
    key: 'sla',
    label: 'SLA',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'more',
    label: 'More',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
]

export function MobileTicketDetail({ ticket, teamMembers, categories, tags, cannedResponses, drafts, departments, scratchpadNotes, assistHistory, mergedTickets, mergedMessages, mergeRecordId, currentUserId, helenAvatarUrl }: MobileTicketDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('conversation')
  const [replyMode, setReplyMode] = useState<'reply' | 'note' | null>(null)
  const [showAssistModal, setShowAssistModal] = useState(false)

  const t = ticket as Record<string, unknown>
  const viewers = useTicketPresence(t.id as string)
  const statusCfg = TICKET_STATUS_CONFIG[t.status as string]
  const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority as string]
  const typeCfg = TICKET_TYPE_CONFIG[t.ticket_type as string]

  const customer = t.customers as Record<string, unknown> | null
  const contact = t.contacts as Record<string, unknown> | null
  const assignee = t.assignee as Record<string, unknown> | null
  const category = t.ticket_categories as Record<string, unknown> | null
  const supportContract = t.support_contracts as Record<string, unknown> | null
  const msgs = (t.messages as Record<string, unknown>[]) || []

  const currentDepartment = t.department_id
    ? departments.find(d => d.id === t.department_id) || null
    : null

  const isMergedSource = Boolean(t.merged_into_ticket_id)

  // Combine messages with merged messages
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

  // Ref for compose-from-assist flow
  const pendingComposeRef = useRef<string | null>(null)

  function handleComposeFromAssist(text: string) {
    pendingComposeRef.current = text
    setShowAssistModal(false)
    setReplyMode('reply')
  }

  const isClosed = ['closed', 'cancelled'].includes(t.status as string)
  const toneScore = t.tone_score as number | null

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] -m-4 bg-white dark:bg-slate-900">
      {/* Compact header */}
      <div className="shrink-0 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pt-3 pb-2 safe-area-inset-top">
        <div className="flex items-center gap-2">
          <Link href="/helpdesk" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 no-underline shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{t.ticket_number as string}</span>
              {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
              {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
              {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
              {toneScore && toneScore >= 3 && <AutogrumpBadge toneScore={toneScore} toneTrend={t.tone_trend as string | null} toneSummary={t.tone_summary as string | null} />}
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1 font-medium mt-0.5">{t.subject as string}</div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              <span className="truncate">{(customer?.name as string) || <span className="text-amber-600 dark:text-amber-400">Unmatched</span>}</span>
              {assignee && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">&middot;</span>
                  <span className="truncate">{assignee.first_name as string} {assignee.last_name as string}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {supportContract ? (
                <>
                  {((supportContract.contract_type as string) === 'helpdesk' || (supportContract.contract_type as string) === 'both') && (
                    <>
                      <Badge label="Remote" color="#059669" bg="#ecfdf5" />
                      <Badge label="Telephone" color="#059669" bg="#ecfdf5" />
                    </>
                  )}
                  {((supportContract.contract_type as string) === 'onsite' || (supportContract.contract_type as string) === 'both') && (
                    <Badge label="Onsite" color="#059669" bg="#ecfdf5" />
                  )}
                </>
              ) : (
                <Badge label="No Contract" color="#dc2626" bg="#fef2f2" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Banners */}
      {viewers.length > 0 && (
        <div className="shrink-0 px-4 pt-2">
          <PresenceBanner viewers={viewers} />
        </div>
      )}

      {isMergedSource && t.merge_target ? (
        <div className="shrink-0 px-4 pt-2">
          <MergedBanner
            targetTicketId={(t.merge_target as Record<string, unknown>).id as string}
            targetTicketNumber={(t.merge_target as Record<string, unknown>).ticket_number as string}
            mergeId={mergeRecordId || null}
          />
        </div>
      ) : null}

      {/* Tab bar — icon + label, fixed */}
      <div className="shrink-0 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'conversation' && (
          <div className="px-4 py-3 space-y-3">
            <MobileConversation messages={allMessages} helenAvatarUrl={helenAvatarUrl} />
            {!isMergedSource && (
              <DraftResponseBanner drafts={drafts} ticketId={t.id as string} />
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="px-4 py-3">
            <MetadataSidebar
              ticket={t}
              teamMembers={teamMembers}
              categories={categories}
              tags={tags}
              currentTags={(t.tags as Record<string, unknown>[]) || []}
              departmentName={currentDepartment?.name || null}
            />
          </div>
        )}

        {activeTab === 'sla' && (
          <div className="px-4 py-3">
            <SlaPanel ticket={t} />
          </div>
        )}

        {activeTab === 'more' && (
          <div className="px-4 py-3 space-y-4">
            <TimeEntries
              ticketId={t.id as string}
              entries={(t.time_entries as Record<string, unknown>[]) || []}
            />
            <MediaSection
              ticketId={t.id as string}
              attachments={(t.attachments as Record<string, unknown>[]) || []}
            />
            {scratchpadNotes && currentUserId && (
              <ScratchpadPanel
                ticketId={t.id as string}
                notes={scratchpadNotes}
                currentUserId={currentUserId}
              />
            )}
            <EscalationSection
              ticketId={t.id as string}
              escalationLevel={t.escalation_level as number}
              currentDepartment={currentDepartment ? { id: currentDepartment.id, name: currentDepartment.name } : null}
              teamMembers={teamMembers}
              departments={departments}
            />
            {mergedTickets && mergedTickets.length > 0 && (
              <MergedTicketsSection mergedTickets={mergedTickets as never[]} />
            )}
            <WatchersSection
              ticketId={t.id as string}
              watchers={(t.watchers as Record<string, unknown>[]) || []}
              teamMembers={teamMembers}
            />
          </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      {!isClosed && !isMergedSource && (
        <div className="shrink-0 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 safe-area-inset-bottom">
          <div className="flex items-center gap-2">
            {/* Helen Assist button */}
            <button
              onClick={() => setShowAssistModal(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 shrink-0"
              title="Helen AI Diagnostic"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </button>

            {/* Reply button */}
            <button
              onClick={() => setReplyMode('reply')}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white active:bg-indigo-700"
            >
              Reply
            </button>

            {/* Internal note button */}
            <button
              onClick={() => setReplyMode('note')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0"
              title="Internal Note"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Reply sheet */}
      {replyMode && (
        <MobileReplySheet
          open={!!replyMode}
          onClose={() => { setReplyMode(null); pendingComposeRef.current = null }}
          ticketId={t.id as string}
          ticketStatus={t.status as string}
          initialMode={replyMode}
          cannedResponses={cannedResponses}
          ticketContext={ticketContext}
          initialBody={pendingComposeRef.current || undefined}
        />
      )}

      {/* Helen Assist Modal */}
      {showAssistModal && (
        <HelenAssistModal
          ticketId={t.id as string}
          ticketContext={assistContext}
          assistHistory={assistHistory || []}
          onClose={() => setShowAssistModal(false)}
          onComposeReply={handleComposeFromAssist}
        />
      )}
    </div>
  )
}
