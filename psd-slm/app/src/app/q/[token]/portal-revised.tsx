interface PortalRevisedProps {
  quote: { quote_number: string }
}

export function PortalRevised({ quote }: PortalRevisedProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Newer Version Available</h2>
      <p className="text-sm text-slate-500">
        Quote <strong>{quote.quote_number}</strong> has been revised. A newer version of this quote is available.
      </p>
      <p className="text-sm text-slate-400 mt-4">
        Please check your email for the updated quote, or contact our sales team.
      </p>
    </div>
  )
}
