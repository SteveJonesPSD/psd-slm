'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CollapsibleCard } from './collapsible-card'
import { OJI_STATUS_CONFIG, OJI_PRIORITY_CONFIG } from '@/lib/onsite-jobs/types'
import type { OnsiteJobItem } from '@/lib/onsite-jobs/types'

interface OnsiteJobsSectionProps {
  items: OnsiteJobItem[]
  customerId: string
}

export function OnsiteJobsSection({ items, customerId }: OnsiteJobsSectionProps) {
  const openCount = items.filter(i => !['complete', 'cancelled'].includes(i.status)).length

  return (
    <CollapsibleCard
      title="Onsite Jobs"
      count={openCount}
      actions={
        <Link
          href={`/helpdesk/onsite-jobs/customer/${customerId}`}
          className="text-xs text-indigo-600 hover:text-indigo-800 no-underline"
        >
          View All
        </Link>
      }
    >
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Ref</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Subject</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Priority</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Logged</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 10).map(item => {
              const statusCfg = OJI_STATUS_CONFIG[item.status]
              const priorityCfg = OJI_PRIORITY_CONFIG[item.priority]
              return (
                <tr key={item.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/helpdesk/onsite-jobs/${item.id}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 no-underline">
                      {item.ref_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-900 dark:text-slate-200">{item.subject}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  No onsite jobs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {items.length > 10 && (
        <div className="mt-3 text-center">
          <Link href={`/helpdesk/onsite-jobs/customer/${customerId}`} className="text-xs text-indigo-600 hover:text-indigo-800 no-underline">
            View all {items.length} onsite jobs
          </Link>
        </div>
      )}
    </CollapsibleCard>
  )
}
