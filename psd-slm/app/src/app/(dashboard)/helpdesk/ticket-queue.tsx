'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, TICKET_TYPE_CONFIG } from '@/components/ui/badge'
import { assignTicket, getTickets, approveDraftResponse } from './actions'
import type { PresenceViewer } from './actions'
import { useAuth } from '@/components/auth-provider'
import { formatTimeRemaining, getSlaStatus } from '@/lib/sla'
import type { TicketSummary } from '@/types/database'
import { ACTIVE_STATUSES, TICKET_STATUSES } from '@/lib/helpdesk'

interface PendingDraft {
  id: string
  ticket_id: string
  draft_type: string
  body: string
  ai_reasoning: string | null
}

interface TicketTag {
  id: string
  name: string
  color: string
}

interface TicketQueueProps {
  initialData: TicketSummary[]
  teamMembers: { id: string; first_name: string; last_name: string }[]
  categories: { id: string; name: string }[]
  brands: { id: string; name: string }[]
  pendingDrafts: PendingDraft[]
  ticketTagMap: Record<string, TicketTag[]>
  selectedTagIds: string[]
  initialPresence: Record<string, PresenceViewer[]>
}

export function TicketQueue({ initialData, teamMembers, categories, brands, pendingDrafts, ticketTagMap, selectedTagIds, initialPresence }: TicketQueueProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [tickets, setTickets] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState(pendingDrafts)
  const [presence, setPresence] = useState(initialPresence)
  const lastPresenceJsonRef = useRef<string>(JSON.stringify(initialPresence))

  // Poll presence every 30 seconds via API route (NOT a server action — avoids RSC refresh)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/helpdesk/queue-presence')
        if (res.ok) {
          const data = await res.json()
          const json = JSON.stringify(data)
          if (json !== lastPresenceJsonRef.current) {
            lastPresenceJsonRef.current = json
            setPresence(data)
          }
        }
      } catch { /* best-effort */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Build a map of ticket_id → draft for quick lookup
  const draftMap = new Map<string, PendingDraft>()
  for (const d of drafts) {
    if (!draftMap.has(d.ticket_id)) {
      draftMap.set(d.ticket_id, d)
    }
  }

  // Apply tag filter (client-side since tags come from a junction table)
  const filteredTickets = selectedTagIds.length > 0
    ? tickets.filter(t => {
        const ticketTags = ticketTagMap[t.id] || []
        return selectedTagIds.some(tagId => ticketTags.some(tt => tt.id === tagId))
      })
    : tickets

  async function applyFilters() {
    setLoading(true)
    try {
      const result = await getTickets({
        search: search || undefined,
        status: statusFilter.length > 0 ? statusFilter : undefined,
        priority: priorityFilter || undefined,
        assigned_to: assignedFilter || undefined,
        ticket_type: typeFilter || undefined,
        category_id: categoryFilter || undefined,
      })
      setTickets(result.data || [])
    } finally {
      setLoading(false)
    }
  }

  async function handleAssignToMe(ticketId: string) {
    await assignTicket(ticketId, user.id)
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, assigned_to: user.id, assigned_to_name: `${user.firstName} ${user.lastName}`, assigned_to_initials: user.initials, assigned_to_color: user.color } : t
    ))
  }

  async function handleQuickApprove(draft: PendingDraft) {
    const result = await approveDraftResponse(draft.id, draft.ticket_id)
    if (!result.error) {
      // Remove from local state
      setDrafts(prev => prev.filter(d => d.id !== draft.id))
      router.refresh()
    }
  }

  function getSlaIndicator(ticket: TicketSummary) {
    // Response SLA
    const responseStatus = getSlaStatus(ticket.sla_response_due_at, ticket.first_responded_at, ticket.created_at)
    // Resolution SLA
    const resolutionStatus = getSlaStatus(ticket.sla_resolution_due_at, ticket.resolved_at, ticket.created_at)

    // Worst of the two
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
    <div>
      <style>{`
        @keyframes queue-presence-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes queue-presence-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyFilters()}
          placeholder="Search tickets..."
          className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setTimeout(applyFilters, 0) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All Priorities</option>
          {['urgent', 'high', 'medium', 'low'].map(p => (
            <option key={p} value={p}>{TICKET_PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>
        <select
          value={assignedFilter}
          onChange={e => { setAssignedFilter(e.target.value); setTimeout(applyFilters, 0) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All Agents</option>
          {teamMembers.map(m => (
            <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setTimeout(applyFilters, 0) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          <option value="helpdesk">Helpdesk</option>
          <option value="onsite_job">Onsite Job</option>
        </select>

        {/* Status toggles */}
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => { setStatusFilter([]); setTimeout(applyFilters, 0) }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              statusFilter.length === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => { setStatusFilter(TICKET_STATUSES); setTimeout(applyFilters, 0) }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              statusFilter.length === TICKET_STATUSES.length ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Ticket</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Priority</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Subject</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Company</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Assigned To</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">SLA</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading...</td>
              </tr>
            ) : filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {selectedTagIds.length > 0 ? 'No tickets match the selected tags.' : 'No tickets found.'}
                </td>
              </tr>
            ) : (
              filteredTickets.map(ticket => {
                const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
                const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority]
                const draft = draftMap.get(ticket.id)
                const ticketTags = ticketTagMap[ticket.id] || []
                return (
                  <tr key={ticket.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/helpdesk/tickets/${ticket.id}`}
                          className="font-bold text-indigo-600 hover:text-indigo-800 no-underline"
                        >
                          {ticket.ticket_number}
                        </Link>
                        {(presence[ticket.id] || []).map(viewer => (
                          <QueuePresenceAvatar key={viewer.id} viewer={viewer} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate shrink">{ticket.subject}</span>
                        {draft && (
                          <DraftPopover draft={draft} onApprove={() => handleQuickApprove(draft)} />
                        )}
                      </div>
                      {ticketTags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ticketTags.map(tag => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-medium"
                              style={{ backgroundColor: `${tag.color}18`, color: tag.color }}
                            >
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{ticket.customer_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ticket.assigned_to_name ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                            style={{ backgroundColor: ticket.assigned_to_color || '#6366f1' }}
                          >
                            {ticket.assigned_to_initials || '?'}
                          </div>
                          <span className="text-slate-600 text-xs">{ticket.assigned_to_name}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAssignToMe(ticket.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Assign to me
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                        {(ticket as unknown as Record<string, unknown>).merged_into_ticket_id ? (
                          <Badge label="Merged" color="#64748b" bg="#f1f5f9" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getSlaIndicator(ticket)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(ticket.created_at).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
        {selectedTagIds.length > 0 && filteredTickets.length !== tickets.length && (
          <span> (filtered from {tickets.length})</span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// QUEUE PRESENCE — pulsing avatar next to ticket number
// ============================================================================

function QueuePresenceAvatar({ viewer }: { viewer: PresenceViewer }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      className="relative flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold text-white overflow-hidden shrink-0"
      style={{
        backgroundColor: viewer.color || '#6366f1',
        animation: 'queue-presence-pulse 3s ease-in-out infinite',
      }}
      title={`${viewer.firstName} ${viewer.lastName} is viewing this ticket`}
    >
      {viewer.avatarUrl && !imgError ? (
        <img
          src={viewer.avatarUrl}
          alt={`${viewer.firstName} ${viewer.lastName}`}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        viewer.initials || `${viewer.firstName[0]}${viewer.lastName[0]}`
      )}
      {/* Ring pulse effect */}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          border: `2px solid ${viewer.color || '#6366f1'}`,
          animation: 'queue-presence-ring 3s ease-out infinite',
        }}
      />
    </div>
  )
}

// ============================================================================
// DRAFT POPOVER — icon with hover preview + click to quick-approve
// ============================================================================

function DraftPopover({ draft, onApprove }: { draft: PendingDraft; onApprove: () => void }) {
  const [showPopover, setShowPopover] = useState(false)
  const [sending, setSending] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setShowPopover(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setShowPopover(false), 200)
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSending(true)
    await onApprove()
    setSending(false)
    setShowPopover(false)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const typeLabel = draft.draft_type === 'needs_detail' ? 'Needs Detail' : 'Response'

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* AI icon — clickable to quick-approve */}
      <button
        onClick={handleClick}
        disabled={sending}
        title="Helen AI draft ready — click to send"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-600 transition-colors hover:bg-violet-500 hover:text-white disabled:opacity-50"
      >
        {sending ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-white" />
        ) : (
          'AI'
        )}
      </button>

      {/* Popover on hover */}
      {showPopover && (
        <div
          ref={popoverRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="absolute left-1/2 top-full z-50 mt-2 w-80 -translate-x-1/2 rounded-xl border border-violet-200 bg-white p-4 shadow-lg"
        >
          {/* Arrow */}
          <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-violet-200 bg-white" />

          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[8px] font-bold text-white">AI</span>
            <span className="text-xs font-semibold text-violet-900">Helen AI Draft</span>
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
              {typeLabel}
            </span>
          </div>

          <div className="mb-3 max-h-40 overflow-y-auto rounded-lg bg-violet-50/50 p-2.5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
            {draft.body}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Click icon to send</span>
            <Link
              href={`/helpdesk/tickets/${draft.ticket_id}`}
              className="text-[10px] text-violet-600 hover:text-violet-800 no-underline"
              onClick={(e) => e.stopPropagation()}
            >
              Review in ticket
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
