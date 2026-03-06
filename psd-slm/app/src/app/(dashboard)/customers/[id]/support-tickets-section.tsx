'use client'

import Link from 'next/link'
import { Badge, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, CONTRACT_TYPE_CONFIG } from '@/components/ui/badge'
import { CollapsibleCard } from './collapsible-card'

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  assigned_to: string | null
  users: { first_name: string; last_name: string; initials: string | null; color: string | null } | null
  updated_at: string
}

interface Contract {
  id: string
  contract_type: string
  monthly_hours: number | null
  start_date: string
  end_date: string
  is_active: boolean
  sla_plans: { name: string } | null
}

interface SupportTicketsSectionProps {
  tickets: Ticket[]
  activeCount: number
  contract: Contract | null
  timeUsedThisMonth: number
  customerId: string
}

export function SupportTicketsSection({ tickets, activeCount, contract, timeUsedThisMonth, customerId }: SupportTicketsSectionProps) {
  return (
    <CollapsibleCard
      title="Support Tickets"
      count={activeCount}
      actions={
        <Link
          href={`/helpdesk?company=${customerId}`}
          className="text-xs text-indigo-600 hover:text-indigo-800 no-underline"
        >
          View All
        </Link>
      }
    >
      {/* Contract Summary */}
      {contract ? (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700">Support Contract</span>
              {CONTRACT_TYPE_CONFIG[contract.contract_type] && (
                <Badge
                  label={CONTRACT_TYPE_CONFIG[contract.contract_type].label}
                  color={CONTRACT_TYPE_CONFIG[contract.contract_type].color}
                  bg={CONTRACT_TYPE_CONFIG[contract.contract_type].bg}
                />
              )}
              {contract.sla_plans ? (
                <span className="text-xs text-slate-500">{(contract.sla_plans as Record<string, unknown>).name as string}</span>
              ) : null}
            </div>
            <div className="text-xs text-slate-500">
              {contract.monthly_hours ? (
                <span>
                  {Math.round(timeUsedThisMonth / 60 * 10) / 10}h / {contract.monthly_hours}h this month
                </span>
              ) : null}
              {' · '}
              Ends {new Date(contract.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <span className="text-xs text-slate-400">No active support contract</span>
        </div>
      )}

      {/* Recent Tickets Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Ticket #</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Subject</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Priority</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Assigned</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => {
              const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
              const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority]
              const agent = ticket.users as Record<string, unknown> | null
              return (
                <tr key={ticket.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/helpdesk/tickets/${ticket.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 no-underline">
                      {ticket.ticket_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-900">{ticket.subject}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {statusCfg ? <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} /> : null}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {priorityCfg ? <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} /> : null}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {agent ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ backgroundColor: (agent.color as string) || '#6b7280' }}
                        >
                          {(agent.initials as string) || `${(agent.first_name as string)[0]}${(agent.last_name as string)[0]}`}
                        </div>
                        <span className="text-xs text-slate-600">{agent.first_name as string}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(ticket.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              )
            })}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No support tickets yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  )
}
