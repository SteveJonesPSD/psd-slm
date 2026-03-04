'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, TICKET_TYPE_CONFIG } from '@/components/ui/badge'
import { MobileConversation } from './mobile-conversation'
import { MobileReplySheet } from './mobile-reply-sheet'
import { DraftResponseBanner } from './draft-response-banner'
import { MetadataSidebar } from './metadata-sidebar'
import { SlaPanel } from './sla-panel'
import { TimeEntries } from './time-entries'
import { MediaSection } from './media-section'
import { EscalationSection } from './escalation-section'
import { WatchersSection } from './watchers-section'
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
  mergedTickets?: Record<string, unknown>[]
  mergedMessages?: Record<string, unknown>[]
  mergeRecordId?: string | null
  currentUserId?: string
}

type Tab = 'conversation' | 'details' | 'sla' | 'more'

const TABS: { key: Tab; label: string }[] = [
  { key: 'conversation', label: 'Conversation' },
  { key: 'details', label: 'Details' },
  { key: 'sla', label: 'SLA' },
  { key: 'more', label: 'More' },
]

export function MobileTicketDetail({ ticket, teamMembers, categories, tags, cannedResponses, drafts, departments }: MobileTicketDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('conversation')
  const [replyMode, setReplyMode] = useState<'reply' | 'note' | null>(null)

  const t = ticket as Record<string, unknown>
  const viewers = useTicketPresence(t.id as string)
  const statusCfg = TICKET_STATUS_CONFIG[t.status as string]
  const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority as string]
  const typeCfg = TICKET_TYPE_CONFIG[t.ticket_type as string]

  const customer = t.customers as Record<string, unknown> | null
  const contact = t.contacts as Record<string, unknown> | null
  const assignee = t.assignee as Record<string, unknown> | null
  const msgs = (t.messages as Record<string, unknown>[]) || []

  const currentDepartment = t.department_id
    ? departments.find(d => d.id === t.department_id) || null
    : null

  const ticketContext: TicketContext = {
    ticketNumber: t.ticket_number as string,
    subject: t.subject as string,
    description: (t.description as string) || null,
    customerName: (customer?.name as string) || 'Unknown',
    contactName: contact ? `${contact.first_name} ${contact.last_name}` : null,
    status: t.status as string,
    priority: t.priority as string,
    ticketType: t.ticket_type as string,
    category: ((t.ticket_categories as Record<string, unknown>)?.name as string) || null,
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

  const isClosed = ['closed', 'cancelled'].includes(t.status as string)

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] -m-4">
      {/* Fixed header */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 pt-3 pb-2">
        <div className="mb-1 flex items-center gap-2">
          <Link href="/helpdesk" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-gray-100 no-underline">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <span className="text-sm font-bold text-indigo-600">{t.ticket_number as string}</span>
          {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
          {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
          {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
        </div>
        <div className="ml-10 text-sm text-slate-700 line-clamp-1 font-medium">{t.subject as string}</div>
        <div className="ml-10 mt-0.5 text-xs text-slate-400">
          {customer?.name as string}
          {assignee && <span> &middot; {assignee.first_name as string} {assignee.last_name as string}</span>}
        </div>
      </div>

      {viewers.length > 0 && (
        <div className="shrink-0 px-4 pt-2">
          <PresenceBanner viewers={viewers} />
        </div>
      )}

      {/* Tab bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-3 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-indigo-600'
                  : 'text-slate-500'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeTab === 'conversation' && (
          <div className="space-y-3">
            <MobileConversation messages={msgs} />
            <DraftResponseBanner drafts={drafts} ticketId={t.id as string} />
          </div>
        )}

        {activeTab === 'details' && (
          <MetadataSidebar
            ticket={t}
            teamMembers={teamMembers}
            categories={categories}
            tags={tags}
            currentTags={(t.tags as Record<string, unknown>[]) || []}
            departmentName={currentDepartment?.name || null}
          />
        )}

        {activeTab === 'sla' && (
          <SlaPanel ticket={t} />
        )}

        {activeTab === 'more' && (
          <div className="space-y-4">
            <TimeEntries
              ticketId={t.id as string}
              entries={(t.time_entries as Record<string, unknown>[]) || []}
            />
            <MediaSection
              ticketId={t.id as string}
              attachments={(t.attachments as Record<string, unknown>[]) || []}
            />
            <EscalationSection
              ticketId={t.id as string}
              escalationLevel={t.escalation_level as number}
              currentDepartment={currentDepartment ? { id: currentDepartment.id, name: currentDepartment.name } : null}
              teamMembers={teamMembers}
              departments={departments}
            />
            <WatchersSection
              ticketId={t.id as string}
              watchers={(t.watchers as Record<string, unknown>[]) || []}
              teamMembers={teamMembers}
            />
          </div>
        )}
      </div>

      {/* Fixed bottom bar */}
      {!isClosed && (
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex gap-3">
          <button
            onClick={() => setReplyMode('reply')}
            className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Reply
          </button>
          <button
            onClick={() => setReplyMode('note')}
            className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Internal Note
          </button>
        </div>
      )}

      {/* Reply sheet */}
      {replyMode && (
        <MobileReplySheet
          open={!!replyMode}
          onClose={() => setReplyMode(null)}
          ticketId={t.id as string}
          ticketStatus={t.status as string}
          initialMode={replyMode}
          cannedResponses={cannedResponses}
          ticketContext={ticketContext}
        />
      )}
    </div>
  )
}
