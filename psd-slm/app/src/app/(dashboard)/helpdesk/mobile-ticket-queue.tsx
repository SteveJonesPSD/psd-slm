'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'
import { AutogrumpBadge } from '@/components/helpdesk/autogrump-badge'
import { assignTicket, getTickets } from './actions'
import { useAuth } from '@/components/auth-provider'
import { formatTimeRemaining, getSlaStatus } from '@/lib/sla'
import { TICKET_STATUSES } from '@/lib/helpdesk'
import { MobileQueueFilters } from './mobile-queue-filters'
import type { TicketSummary } from '@/types/database'

interface TicketTag {
  id: string
  name: string
  color: string
}

interface PendingDraft {
  id: string
  ticket_id: string
  draft_type: string
  body: string
  ai_reasoning: string | null
}

interface MobileTicketQueueProps {
  initialData: TicketSummary[]
  teamMembers: { id: string; first_name: string; last_name: string }[]
  categories: { id: string; name: string }[]
  brands: { id: string; name: string }[]
  pendingDrafts: PendingDraft[]
  ticketTagMap: Record<string, TicketTag[]>
  selectedTagIds: string[]
  stats: { openCount: number; unassigned: number; newCount: number; breached: number }
}

export function MobileTicketQueue({
  initialData,
  teamMembers,
  pendingDrafts,
  ticketTagMap,
  selectedTagIds,
  stats,
}: MobileTicketQueueProps) {
  const { user } = useAuth()
  const [tickets, setTickets] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Customer waiting polling
  const [customerWaiting, setCustomerWaiting] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const t of initialData) {
      if (t.customer_waiting) map[t.id] = true
    }
    return map
  })
  const lastWaitingJsonRef = useRef<string>('')

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/helpdesk/queue-waiting')
        if (res.ok) {
          const data = await res.json()
          const json = JSON.stringify(data)
          if (json !== lastWaitingJsonRef.current) {
            lastWaitingJsonRef.current = json
            setCustomerWaiting(data)
          }
        }
      } catch { /* best-effort */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const draftMap = new Map<string, PendingDraft>()
  for (const d of pendingDrafts) {
    if (!draftMap.has(d.ticket_id)) draftMap.set(d.ticket_id, d)
  }

  const filteredTickets = selectedTagIds.length > 0
    ? tickets.filter(t => {
        const tags = ticketTagMap[t.id] || []
        return selectedTagIds.some(tagId => tags.some(tt => tt.id === tagId))
      })
    : tickets

  const hasActiveFilters = !!(search || priorityFilter || assignedFilter || typeFilter || showAll)

  async function applyFilters() {
    setLoading(true)
    try {
      const result = await getTickets({
        search: search || undefined,
        status: showAll ? TICKET_STATUSES : undefined,
        priority: priorityFilter || undefined,
        assigned_to: assignedFilter || undefined,
        ticket_type: typeFilter || undefined,
      })
      setTickets(result.data || [])
    } finally {
      setLoading(false)
    }
  }

  function clearFilters() {
    setSearch('')
    setPriorityFilter('')
    setAssignedFilter('')
    setTypeFilter('')
    setShowAll(false)
  }

  async function handleAssignToMe(e: React.MouseEvent, ticketId: string) {
    e.preventDefault()
    e.stopPropagation()
    await assignTicket(ticketId, user.id)
    setTickets(prev => prev.map(t =>
      t.id === ticketId
        ? { ...t, assigned_to: user.id, assigned_to_name: `${user.firstName} ${user.lastName}`, assigned_to_initials: user.initials, assigned_to_color: user.color }
        : t
    ))
  }

  function getSlaIndicator(ticket: TicketSummary) {
    const responseStatus = getSlaStatus(ticket.sla_response_due_at, ticket.first_responded_at, ticket.created_at)
    const resolutionStatus = getSlaStatus(ticket.sla_resolution_due_at, ticket.resolved_at, ticket.created_at)

    const worst = responseStatus === 'breached' || resolutionStatus === 'breached' ? 'breached'
      : responseStatus === 'at_risk' || resolutionStatus === 'at_risk' ? 'at_risk'
      : responseStatus === 'met' && resolutionStatus === 'met' ? 'met'
      : 'on_track'

    if (!ticket.sla_response_due_at && !ticket.sla_resolution_due_at) return null

    const color = worst === 'breached' ? '#dc2626' : worst === 'at_risk' ? '#d97706' : '#059669'
    const dueAt = ticket.sla_resolution_due_at || ticket.sla_response_due_at

    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {worst === 'met' ? 'Met' : dueAt ? formatTimeRemaining(dueAt) : ''}
      </span>
    )
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Service Desk</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/helpdesk/tickets/new"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white no-underline active:bg-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New
          </Link>
          <button
            onClick={() => setShowFilters(true)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'border-gray-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
            }`}
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5">
        <StatPill label="Open" value={stats.openCount} color="#2563eb" />
        <StatPill label="Unassigned" value={stats.unassigned} color={stats.unassigned > 0 ? '#d97706' : '#64748b'} />
        <StatPill label="New" value={stats.newCount} color="#6366f1" />
        <StatPill label="SLA" value={stats.breached} color={stats.breached > 0 ? '#dc2626' : '#059669'} />
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {search && <FilterChip label={`"${search}"`} onDismiss={() => { setSearch(''); applyFilters() }} />}
          {priorityFilter && <FilterChip label={priorityFilter} onDismiss={() => { setPriorityFilter(''); applyFilters() }} />}
          {assignedFilter && (
            <FilterChip
              label={teamMembers.find(m => m.id === assignedFilter)?.first_name || 'Agent'}
              onDismiss={() => { setAssignedFilter(''); applyFilters() }}
            />
          )}
          {typeFilter && <FilterChip label={typeFilter} onDismiss={() => { setTypeFilter(''); applyFilters() }} />}
          {showAll && <FilterChip label="All statuses" onDismiss={() => { setShowAll(false); applyFilters() }} />}
        </div>
      )}

      {/* Ticket cards */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          {selectedTagIds.length > 0 ? 'No tickets match the selected tags.' : 'No tickets found.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map(ticket => {
            const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
            const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority]
            const draft = draftMap.get(ticket.id)
            const ticketTags = ticketTagMap[ticket.id] || []
            const isWaiting = customerWaiting[ticket.id]

            return (
              <Link
                key={ticket.id}
                href={`/helpdesk/tickets/${ticket.id}`}
                className={`block rounded-xl border p-3 no-underline active:bg-gray-50 dark:active:bg-slate-700 transition-colors ${
                  isWaiting
                    ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-900/10'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
              >
                {/* Row 1: ticket number + priority + tone */}
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{ticket.ticket_number}</span>
                    {ticket.source === 'email' && (
                      <svg className="h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    )}
                    <AutogrumpBadge toneScore={ticket.tone_score} toneTrend={ticket.tone_trend} toneSummary={ticket.tone_summary} />
                    {draft && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-[7px] font-bold text-violet-600 dark:text-violet-300">
                        AI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                  </div>
                </div>

                {/* Row 2: subject */}
                <div className={`mb-1.5 text-sm line-clamp-2 leading-snug ${
                  isWaiting
                    ? 'font-bold text-slate-900 dark:text-white'
                    : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {ticket.subject}
                </div>

                {/* Row 3: company, assignee, status */}
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className={`truncate ${!ticket.customer_name ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}`}>
                    {ticket.customer_name || 'Needs Assignment'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  {ticket.assigned_to_name ? (
                    <span className="flex items-center gap-1 truncate">
                      <span
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                        style={{ backgroundColor: ticket.assigned_to_color || '#6366f1' }}
                      >
                        {ticket.assigned_to_initials || '?'}
                      </span>
                      <span className="truncate">{ticket.assigned_to_name}</span>
                    </span>
                  ) : (
                    <button
                      onClick={(e) => handleAssignToMe(e, ticket.id)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400"
                    >
                      Assign to me
                    </button>
                  )}
                  <span className="ml-auto shrink-0">
                    {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                  </span>
                </div>

                {/* Row 4: SLA + tags */}
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {ticketTags.slice(0, 3).map(tag => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-medium"
                        style={{ backgroundColor: `${tag.color}18`, color: tag.color }}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </span>
                    ))}
                    {ticketTags.length > 3 && (
                      <span className="text-[10px] text-slate-400">+{ticketTags.length - 3}</span>
                    )}
                  </div>
                  {getSlaIndicator(ticket)}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Count footer */}
      <div className="mt-3 text-xs text-slate-400 dark:text-slate-500 text-center">
        {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
      </div>

      {/* Filter sheet */}
      <MobileQueueFilters
        open={showFilters}
        onClose={() => setShowFilters(false)}
        search={search}
        setSearch={setSearch}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        assignedFilter={assignedFilter}
        setAssignedFilter={setAssignedFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        showAll={showAll}
        setShowAll={setShowAll}
        teamMembers={teamMembers}
        onApply={applyFilters}
        onClear={clearFilters}
      />
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium"
      style={{ backgroundColor: `${color}12`, color }}
    >
      <span className="text-base font-bold leading-none">{value}</span>
      {label}
    </div>
  )
}

function FilterChip({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
      {label}
      <button onClick={onDismiss} className="ml-0.5 text-indigo-400 hover:text-indigo-600 dark:text-indigo-500">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}
