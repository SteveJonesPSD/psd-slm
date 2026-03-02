interface PortalDeclinedProps {
  quote: { quote_number: string }
}

export function PortalDeclined({ quote }: PortalDeclinedProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Quote Declined</h2>
      <p className="text-sm text-slate-500">
        Quote <strong>{quote.quote_number}</strong> has been declined.
      </p>
      <p className="text-sm text-slate-400 mt-4">
        If you'd like to discuss further options, please contact our sales team.
      </p>
    </div>
  )
}
