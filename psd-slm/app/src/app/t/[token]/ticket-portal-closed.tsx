interface TicketPortalClosedProps {
  ticketNumber: string
  subject: string
}

export function TicketPortalClosed({ ticketNumber, subject }: TicketPortalClosedProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">{ticketNumber}</h2>
      <p className="text-sm font-medium text-slate-700 mb-4">{subject}</p>
      <p className="text-sm text-slate-500">
        This ticket has been closed. If you need further assistance, please contact our support team.
      </p>
    </div>
  )
}
