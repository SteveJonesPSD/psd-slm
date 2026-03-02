export function PortalNotFound() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Quote Not Found</h2>
      <p className="text-sm text-slate-500">
        This quote link is invalid or the quote is not currently available.
      </p>
      <p className="text-sm text-slate-400 mt-4">
        Please contact our sales team if you believe this is an error.
      </p>
    </div>
  )
}
