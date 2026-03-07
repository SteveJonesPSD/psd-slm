'use client'

import Link from 'next/link'
import { GROUP_TYPE_LABELS } from '@/types/company-groups'
import type { CompanyGroup } from '@/types/company-groups'

interface GroupDashboardClientProps {
  group: CompanyGroup
  statsMap: Record<string, { openTickets: number; activeContracts: number; openQuotes: number }>
  parentCompanyName: string
}

export function GroupDashboardClient({ group, statsMap, parentCompanyName }: GroupDashboardClientProps) {
  const members = group.members || []

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{group.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {GROUP_TYPE_LABELS[group.group_type]} &middot; Viewing as {parentCompanyName}
        </p>
      </div>

      {/* Parent company card */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-4">Parent Organisation</h2>
        <MemberCard
          name={parentCompanyName}
          colour="#7c3aed"
          stats={statsMap[group.parent_company_id]}
          isParent
        />
      </div>

      {/* Member grid */}
      {members.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-4">
            Members ({members.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {members.map((member) => (
              <MemberCard
                key={member.id}
                name={member.company?.name || 'Unknown'}
                colour={member.colour}
                stats={statsMap[member.company_id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3">
        <Link
          href="/portal/group/tickets"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-sm font-medium no-underline hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
        >
          View Group Tickets
        </Link>
      </div>
    </div>
  )
}

function MemberCard({
  name,
  colour,
  stats,
  isParent,
}: {
  name: string
  colour: string
  stats?: { openTickets: number; activeContracts: number; openQuotes: number }
  isParent?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Colour bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: colour }} />

      <div className="pl-5 pr-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{name}</h3>
          {isParent && (
            <span className="rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-[10px] font-medium">
              Parent
            </span>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <StatItem label="Open Tickets" value={stats.openTickets} />
            <StatItem label="Contracts" value={stats.activeContracts} />
            <StatItem label="Open Quotes" value={stats.openQuotes} />
          </div>
        )}
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  )
}
