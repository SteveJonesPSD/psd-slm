interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  // #1e293b is slate-800 — invisible on dark backgrounds, so treat it as default
  const useDefault = !accent || accent === '#1e293b'
  return (
    <div className="flex-1 min-w-[120px] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5">
      <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
        {label}
      </div>
      <div
        className={`text-lg sm:text-xl md:text-2xl font-bold leading-tight tracking-tight${useDefault ? ' text-slate-800 dark:text-white' : ''}`}
        style={useDefault ? undefined : { color: accent }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs text-slate-400">{sub}</div>
      )}
    </div>
  )
}
