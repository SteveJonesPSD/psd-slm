interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
}

export function StatCard({ label, value, sub, accent = '#1e293b' }: StatCardProps) {
  return (
    <div className="flex-1 min-w-[160px] rounded-xl border border-gray-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
        {label}
      </div>
      <div
        className="text-[28px] font-bold leading-tight tracking-tight"
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
