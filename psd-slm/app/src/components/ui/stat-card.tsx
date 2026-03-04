interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
}

export function StatCard({ label, value, sub, accent = '#1e293b' }: StatCardProps) {
  return (
    <div className="flex-1 min-w-[120px] rounded-xl border border-gray-200 bg-white px-4 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-4">
      <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
        {label}
      </div>
      <div
        className="text-lg sm:text-xl md:text-2xl font-bold leading-tight tracking-tight"
        style={{ color: accent }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs text-slate-400">{sub}</div>
      )}
    </div>
  )
}
