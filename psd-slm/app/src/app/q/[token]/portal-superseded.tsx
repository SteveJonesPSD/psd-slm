interface PortalSupersededProps {
  quote: { quote_number: string }
}

export function PortalSuperseded({ quote }: PortalSupersededProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Quote Superseded</h2>
      <p className="text-sm text-slate-500">
        Quote <strong>{quote.quote_number}</strong> has been replaced by a newer revision.
      </p>
      <p className="text-sm text-slate-400 mt-4">
        Please check your email for the updated quote, or contact our sales team.
      </p>
    </div>
  )
}
