'use client'

import { useState } from 'react'
import type { MailProcessingLog } from '@/lib/email/types'

interface Props {
  entries: MailProcessingLog[]
}

export function ProcessingLogTable({ entries }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-slate-700 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
            <th className="px-6 py-3">Time</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Found</th>
            <th className="px-4 py-3">Processed</th>
            <th className="px-4 py-3">Skipped</th>
            <th className="px-4 py-3">Errors</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            const duration = entry.poll_ended_at && entry.poll_started_at
              ? Math.round((new Date(entry.poll_ended_at).getTime() - new Date(entry.poll_started_at).getTime()) / 1000)
              : null
            const hasErrors = entry.errors && (entry.errors as unknown[]).length > 0

            return (
              <tr
                key={entry.id}
                className={`border-b border-gray-50 dark:border-slate-700/50 ${hasErrors ? 'cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-900/10' : ''}`}
                onClick={() => hasErrors ? setExpandedId(expandedId === entry.id ? null : entry.id) : undefined}
              >
                <td className="px-6 py-3 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {new Date(entry.poll_started_at).toLocaleString('en-GB')}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {duration !== null ? `${duration}s` : '...'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                  {entry.messages_found}
                </td>
                <td className="px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400">
                  {entry.messages_processed}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {entry.messages_skipped}
                </td>
                <td className="px-4 py-3 text-xs">
                  {hasErrors ? (
                    <span className="text-red-600 dark:text-red-400">
                      {(entry.errors as unknown[]).length} {expandedId === entry.id ? '▾' : '▸'}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
              </tr>
            )
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                No poll cycles recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Expanded error details */}
      {expandedId && (() => {
        const entry = entries.find(e => e.id === expandedId)
        if (!entry || !entry.errors) return null
        const errors = entry.errors as { messageId: string; error: string }[]
        return (
          <div className="border-t border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-6 py-3">
            <p className="mb-2 text-xs font-medium text-red-700 dark:text-red-400">Error Details</p>
            <div className="space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="text-xs text-red-600 dark:text-red-400">
                  <span className="font-mono">{err.messageId}:</span> {err.error}
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
