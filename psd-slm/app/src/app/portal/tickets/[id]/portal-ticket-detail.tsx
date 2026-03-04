'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'
import { addPortalReply } from '@/lib/portal/actions'

interface Message {
  id: string
  body: string
  sender_type: string
  is_internal: boolean
  created_at: string
  sender_name: string | null
  contact_id: string | null
}

interface TicketData {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  first_responded_at: string | null
  customers: { name: string } | null
  contacts: { first_name: string; last_name: string } | null
  assigned: { first_name: string; last_name: string } | null
  ticket_categories: { name: string } | null
  sla_plans: {
    name: string
    sla_plan_targets: { priority: string; response_time_minutes: number; resolution_time_minutes: number }[]
  } | null
  messages: Message[]
}

interface PortalContact {
  id: string
  first_name: string
  last_name: string
}

export function PortalTicketDetail({ ticket, contact }: { ticket: TicketData; contact: PortalContact }) {
  const router = useRouter()
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)

    const formData = new FormData()
    formData.set('body', reply)
    const result = await addPortalReply(ticket.id, formData)

    if (result.error) {
      alert(result.error)
    } else {
      setReply('')
      router.refresh()
    }
    setSending(false)
  }

  // SLA info for customer
  const slaTarget = ticket.sla_plans?.sla_plan_targets?.find(
    t => t.priority === ticket.priority
  )
  const responseHours = slaTarget ? Math.round(slaTarget.response_time_minutes / 60) : null

  const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
  const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority]

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/portal/tickets" className="text-slate-400 hover:text-slate-600 no-underline">
          Tickets
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-700">{ticket.ticket_number}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
          {statusCfg ? <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} /> : null}
          {priorityCfg ? <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} /> : null}
        </div>
        <div className="text-xs text-slate-400">
          Created {new Date(ticket.created_at).toLocaleString('en-GB')}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Conversation */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Messages */}
          <div className="space-y-3">
            {ticket.messages.map(msg => {
              if (msg.sender_type === 'system') {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="text-xs text-slate-400">{msg.body}</span>
                  </div>
                )
              }

              const isCustomer = msg.sender_type === 'customer'
              return (
                <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl p-4 ${isCustomer ? 'bg-indigo-50' : 'bg-white border border-gray-200'}`}>
                    <div className="mb-1 flex items-center justify-between gap-4">
                      <span className="text-xs font-semibold text-slate-700">
                        {msg.sender_name || (isCustomer ? 'You' : 'Support Agent')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{msg.body}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reply Box */}
          {!['closed', 'cancelled'].includes(ticket.status) && (
            <form onSubmit={handleReply} className="rounded-xl border border-gray-200 bg-white p-4">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                rows={3}
                placeholder="Type your reply..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-[260px] shrink-0">
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ticket Info</h4>

            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Status</span>
              <span className="text-slate-700 font-medium">
                {statusCfg?.label || ticket.status}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Priority</span>
              <span className="text-slate-700 font-medium">
                {priorityCfg?.label || ticket.priority}
              </span>
            </div>
            {ticket.ticket_categories ? (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Category</span>
                <span className="text-slate-700">{(ticket.ticket_categories as Record<string, unknown>).name as string}</span>
              </div>
            ) : null}
            {ticket.assigned ? (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Assigned To</span>
                <span className="text-slate-700">
                  {(ticket.assigned as Record<string, unknown>).first_name as string} {(ticket.assigned as Record<string, unknown>).last_name as string}
                </span>
              </div>
            ) : null}

            <div className="border-t border-gray-100 pt-3">
              {ticket.first_responded_at ? (
                <div className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
                  Response received
                </div>
              ) : responseHours ? (
                <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  We aim to respond within {responseHours} hour{responseHours !== 1 ? 's' : ''}
                </div>
              ) : null}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Created</span>
                <span className="text-slate-700">{new Date(ticket.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Updated</span>
                <span className="text-slate-700">{new Date(ticket.updated_at).toLocaleDateString('en-GB')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
