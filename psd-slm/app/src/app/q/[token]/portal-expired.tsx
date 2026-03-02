interface PortalExpiredProps {
  quote: { quote_number: string }
}

export function PortalExpired({ quote }: PortalExpiredProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Quote Expired</h2>
      <p className="text-sm text-slate-500">
        Quote <strong>{quote.quote_number}</strong> has expired and is no longer available for acceptance.
      </p>
      <p className="text-sm text-slate-400 mt-4">
        Please contact our sales team if you would like an updated quote.
      </p>
    </div>
  )
}
