interface TicketPortalMergedProps {
  ticketNumber: string
  subject: string
  targetToken: string
  targetTicketNumber: string
}

export function TicketPortalMerged({ ticketNumber, subject, targetToken, targetTicketNumber }: TicketPortalMergedProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">{ticketNumber}</h2>
      <p className="text-sm font-medium text-slate-700 mb-4">{subject}</p>
      <p className="text-sm text-slate-500 mb-6">
        Your ticket has been merged into <span className="font-semibold">{targetTicketNumber}</span> for faster resolution.
        All your messages have been preserved on the combined ticket.
      </p>
      <a
        href={`/t/${targetToken}`}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors no-underline"
      >
        Continue to {targetTicketNumber}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </a>
    </div>
  )
}
