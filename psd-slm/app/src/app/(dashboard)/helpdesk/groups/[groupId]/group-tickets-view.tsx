'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { formatRelativeTime } from '@/lib/utils'

interface GroupTicket {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  customer_id: string
  customer_name: string
  assigned_to: { first_name: string; last_name: string; initials: string | null; color: string | null } | null
}

interface GroupTicketsViewProps {
  tickets: GroupTicket[]
  colourMap: Record<string, string>
  nameMap: Record<string, string>
  groupName: string
  totalCount: number
}

export function GroupTicketsView({ tickets, colourMap, nameMap, groupName, totalCount }: GroupTicketsViewProps) {
  const router = useRouter()
  const allCompanyIds = Object.keys(nameMap)
  const [visibleCompanies, setVisibleCompanies] = useState<Set<string>>(new Set(allCompanyIds))
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const toggleCompany = (companyId: string) => {
    setVisibleCompanies(prev => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (!visibleCompanies.has(t.customer_id)) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.ticket_number.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [tickets, visibleCompanies, statusFilter, search])

  return (
    <div>
      <PageHeader
        title={`${groupName} — Group Tickets`}
        subtitle={`${totalCount} tickets across ${allCompanyIds.length} companies`}
      />

      {/* Toggle pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {allCompanyIds.map(cid => {
          const isActive = visibleCompanies.has(cid)
          const colour = colourMap[cid] || '#6b7280'
          return (
            <button
              key={cid}
              type="button"
              onClick={() => toggleCompany(cid)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors"
              style={{
                borderColor: colour,
                backgroundColor: isActive ? colour : 'transparent',
                color: isActive ? '#fff' : colour,
              }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: isActive ? '#fff' : colour }}
              />
              {nameMap[cid]}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-400 text-slate-700 dark:text-slate-200"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_on_customer">Waiting on Customer</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Ticket table */}
      {filteredTickets.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">No tickets match the current filters.</div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Ticket</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Assigned</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredTickets.map((t) => {
                const colour = colourMap[t.customer_id] || '#6b7280'
                const statusCfg = TICKET_STATUS_CONFIG[t.status]
                const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority]
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => router.push(`/helpdesk/tickets/${t.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colour }} />
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{t.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {t.ticket_number}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-700 dark:text-slate-200 truncate block max-w-[300px]">{t.subject}</span>
                    </td>
                    <td className="px-4 py-3">
                      {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500 dark:text-slate-400">
                      {t.assigned_to ? `${t.assigned_to.first_name} ${t.assigned_to.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-400">
                      {formatRelativeTime(t.updated_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
