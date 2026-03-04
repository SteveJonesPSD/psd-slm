'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  updated_at: string
  contact_id: string
  contacts: { first_name: string; last_name: string } | null
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface PortalContact {
  id: string
  first_name: string
  last_name: string
  is_overseer: boolean
  customer: { name: string }
}

export function PortalTicketList({ tickets, contact, companyContacts }: {
  tickets: Ticket[]
  contact: PortalContact
  companyContacts: Contact[]
}) {
  const [statusFilter, setStatusFilter] = useState('open')
  const [contactFilter, setContactFilter] = useState('')

  const filtered = tickets.filter(t => {
    if (statusFilter === 'open' && ['resolved', 'closed', 'cancelled'].includes(t.status)) return false
    if (statusFilter === 'resolved' && !['resolved', 'closed'].includes(t.status)) return false
    if (contactFilter && t.contact_id !== contactFilter) return false
    return true
  })

  return (
    <div>
      {/* Overseer Banner */}
      {contact.is_overseer && (
        <div className="mb-4 rounded-lg bg-indigo-50 px-4 py-2.5 text-sm text-indigo-700">
          You are viewing all support tickets for <strong>{contact.customer.name}</strong>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Support Tickets</h1>
        <Link
          href="/portal/tickets/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
        >
          New Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        {contact.is_overseer && companyContacts.length > 0 && (
          <select
            value={contactFilter}
            onChange={e => setContactFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Contacts</option>
            {companyContacts.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tickets Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Ticket #</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Subject</th>
              {contact.is_overseer && (
                <th className="px-4 py-3 text-left font-medium text-slate-500">Raised By</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Priority</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ticket => {
              const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
              const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority]
              return (
                <tr key={ticket.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/portal/tickets/${ticket.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 no-underline">
                      {ticket.ticket_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-900">{ticket.subject}</td>
                  {contact.is_overseer && (
                    <td className="px-4 py-3 text-slate-600">
                      {ticket.contacts ? `${ticket.contacts.first_name} ${ticket.contacts.last_name}` : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {statusCfg ? <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} /> : null}
                  </td>
                  <td className="px-4 py-3">
                    {priorityCfg ? <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} /> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(ticket.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={contact.is_overseer ? 6 : 5} className="px-4 py-8 text-center text-slate-400">
                  No tickets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
