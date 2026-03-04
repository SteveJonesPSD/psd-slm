'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { StatCard } from '@/components/ui/stat-card'
import { getHelenAssistUsage } from '../../actions'
import type { HelenAssistUsage } from '@/types/database'

interface AssistUsageViewProps {
  usage: HelenAssistUsage[]
  teamMembers: { id: string; first_name: string; last_name: string }[]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

export function AssistUsageView({ usage: initialUsage, teamMembers }: AssistUsageViewProps) {
  const router = useRouter()
  const [usage, setUsage] = useState<HelenAssistUsage[]>(initialUsage)
  const [loading, setLoading] = useState(false)
  const [filterUser, setFilterUser] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  async function applyFilters() {
    setLoading(true)
    const result = await getHelenAssistUsage({
      startDate: filterStartDate || undefined,
      endDate: filterEndDate || undefined,
      userId: filterUser || undefined,
    })
    setUsage(result.data || [])
    setLoading(false)
  }

  function clearFilters() {
    setFilterUser('')
    setFilterStartDate('')
    setFilterEndDate('')
    setUsage(initialUsage)
  }

  // Stats
  const now = new Date()
  const thisMonth = usage.filter((u) => {
    const d = new Date(u.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const totalCallsThisMonth = thisMonth.length
  const totalTokensThisMonth = thisMonth.reduce((sum, u) => sum + u.total_tokens, 0)
  const uniqueUsersThisMonth = new Set(thisMonth.map((u) => u.user_id)).size

  // Top category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {}
    for (const u of usage) {
      const cat = u.category_name || 'Uncategorised'
      if (!counts[cat]) counts[cat] = { name: cat, count: 0 }
      counts[cat].count++
    }
    return Object.values(counts).sort((a, b) => b.count - a.count)
  }, [usage])

  const topCategory = categoryCounts[0]?.name || 'N/A'

  // Top 5 categories for training insight
  const top5Categories = categoryCounts.slice(0, 5)

  const hasFilters = filterUser || filterStartDate || filterEndDate

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">AI Assist Usage</h2>
      <p className="text-sm text-slate-500 mb-6">
        Track Helen AI diagnostic calls, token usage, and identify training opportunities
      </p>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Calls This Month"
          value={totalCallsThisMonth}
        />
        <StatCard
          label="Tokens This Month"
          value={formatTokens(totalTokensThisMonth)}
        />
        <StatCard
          label="Unique Users"
          value={uniqueUsersThisMonth}
        />
        <StatCard
          label="Top Category"
          value={topCategory}
        />
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">User</label>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Users</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">From</label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">To</label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          />
        </div>
        <button
          onClick={applyFilters}
          disabled={loading}
          className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Apply'}
        </button>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Usage Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">User</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ticket</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Category</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Input</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Output</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    No AI assist calls recorded yet
                  </td>
                </tr>
              ) : (
                usage.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-2 text-xs text-slate-700 whitespace-nowrap">{row.user_name}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => router.push(`/helpdesk/tickets/${row.ticket_id}`)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        {row.ticket_number}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{row.category_name || 'Uncategorised'}</td>
                    <td className="px-4 py-2 text-xs text-slate-500 text-right whitespace-nowrap">{row.input_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs text-slate-500 text-right whitespace-nowrap">{row.output_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs font-medium text-slate-700 text-right whitespace-nowrap">{row.total_tokens.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Training Insight */}
      {top5Categories.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">Training Insight</h3>
          <p className="text-xs text-amber-600 mb-3">
            Categories where agents most frequently need AI help may indicate training opportunities.
          </p>
          <div className="space-y-1.5">
            {top5Categories.map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                    {i + 1}
                  </span>
                  <span className="text-xs text-slate-700">{cat.name}</span>
                </div>
                <span className="text-xs font-medium text-slate-600">{cat.count} call{cat.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
