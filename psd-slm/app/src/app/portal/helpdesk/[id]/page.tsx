import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalTicketDetail } from '@/lib/portal/helpdesk-actions'
import { formatDate } from '@/lib/utils'
import { TicketReplyForm } from './ticket-reply-form'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Awaiting Your Reply',
  resolved: 'Resolved',
  closed: 'Closed',
}

export default async function PortalTicketDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await requirePortalSession()
  const data = await getPortalTicketDetail(id, ctx)

  if (!data) notFound()

  const { ticket, messages } = data
  const isOpen = !['resolved', 'closed', 'cancelled'].includes(ticket.status)

  return (
    <div>
      <Link href="/portal/helpdesk" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-6">
        &larr; Support
      </Link>

      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-mono text-slate-400">{ticket.ticketNumber}</span>
          <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[11px] font-medium">
            {STATUS_LABELS[ticket.status] || ticket.status}
          </span>
          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[11px] font-medium">
            {ticket.priority}
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
        <div className="mt-1 text-xs text-slate-400">
          Opened {formatDate(ticket.createdAt)}
          {ticket.assignedToName && <> &middot; Assigned to {ticket.assignedToName}</>}
        </div>
      </div>

      {/* Thread */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-6">
        <div className="divide-y divide-slate-100">
          {messages.map((msg) => (
            <div key={msg.id} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-white text-[11px] font-bold ${
                  msg.authorType === 'customer' ? 'bg-indigo-500' : 'bg-emerald-500'
                }`}>
                  {msg.authorName[0]}
                </div>
                <span className="text-sm font-medium text-slate-900">{msg.authorName}</span>
                <span className="text-xs text-slate-400">{formatDate(msg.createdAt)}</span>
              </div>
              <div className="pl-9 text-sm text-slate-700 whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Reply form */}
      {isOpen && <TicketReplyForm ticketId={ticket.id} />}

      {ticket.status === 'resolved' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm text-green-700">This ticket has been resolved.</p>
          <p className="mt-1 text-xs text-green-600">Replying will reopen it.</p>
          <TicketReplyForm ticketId={ticket.id} />
        </div>
      )}
    </div>
  )
}
