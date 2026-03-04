'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MailProcessingLog, MessageDetail } from '@/lib/email/types'

interface Props {
  entries: MailProcessingLog[]
}

const ACTION_BADGE_CONFIG: Record<string, { label: string; color: string; bg: string; darkColor: string; darkBg: string }> = {
  created_ticket: { label: 'New Ticket', color: 'text-emerald-700', bg: 'bg-emerald-50', darkColor: 'dark:text-emerald-300', darkBg: 'dark:bg-emerald-900/30' },
  threaded_to_ticket: { label: 'Threaded', color: 'text-blue-700', bg: 'bg-blue-50', darkColor: 'dark:text-blue-300', darkBg: 'dark:bg-blue-900/30' },
  rejected: { label: 'Rejected', color: 'text-amber-700', bg: 'bg-amber-50', darkColor: 'dark:text-amber-300', darkBg: 'dark:bg-amber-900/30' },
  skipped: { label: 'Skipped', color: 'text-slate-600', bg: 'bg-slate-50', darkColor: 'dark:text-slate-300', darkBg: 'dark:bg-slate-700/30' },
  error: { label: 'Error', color: 'text-red-700', bg: 'bg-red-50', darkColor: 'dark:text-red-300', darkBg: 'dark:bg-red-900/30' },
}

export function ProcessingLogTable({ entries }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedType, setExpandedType] = useState<'errors' | 'rejections' | 'details' | null>(null)

  const toggleExpand = (id: string, type: 'errors' | 'rejections' | 'details') => {
    if (expandedId === id && expandedType === type) {
      setExpandedId(null)
      setExpandedType(null)
    } else {
      setExpandedId(id)
      setExpandedType(type)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-slate-700 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
            <th className="px-6 py-3">Time</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Found</th>
            <th className="px-4 py-3">Processed</th>
            <th className="px-4 py-3">Rejected</th>
            <th className="px-4 py-3">Skipped</th>
            <th className="px-4 py-3">Errors</th>
            <th className="px-4 py-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            const duration = entry.poll_ended_at && entry.poll_started_at
              ? Math.round((new Date(entry.poll_ended_at).getTime() - new Date(entry.poll_started_at).getTime()) / 1000)
              : null
            const hasErrors = entry.errors && (entry.errors as unknown[]).length > 0
            const rejections = (entry.rejections || []) as { messageId: string; reason: string }[]
            const hasRejections = rejections.length > 0
            const details = (entry.message_details || []) as MessageDetail[]
            const hasDetails = details.length > 0

            return (
              <>
                <tr
                  key={entry.id}
                  className="border-b border-gray-50 dark:border-slate-700/50"
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
                  <td
                    className="px-4 py-3 text-xs cursor-pointer"
                    onClick={() => hasRejections ? toggleExpand(entry.id, 'rejections') : undefined}
                  >
                    {hasRejections ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {rejections.length} {expandedId === entry.id && expandedType === 'rejections' ? '▾' : '▸'}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {entry.messages_skipped}
                  </td>
                  <td
                    className="px-4 py-3 text-xs cursor-pointer"
                    onClick={() => hasErrors ? toggleExpand(entry.id, 'errors') : undefined}
                  >
                    {hasErrors ? (
                      <span className="text-red-600 dark:text-red-400">
                        {(entry.errors as unknown[]).length} {expandedId === entry.id && expandedType === 'errors' ? '▾' : '▸'}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-xs cursor-pointer"
                    onClick={() => hasDetails ? toggleExpand(entry.id, 'details') : undefined}
                  >
                    {hasDetails ? (
                      <span className="text-indigo-600 dark:text-indigo-400">
                        {details.length} {expandedId === entry.id && expandedType === 'details' ? '▾' : '▸'}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">&mdash;</span>
                    )}
                  </td>
                </tr>

                {/* Expanded error details */}
                {expandedId === entry.id && expandedType === 'errors' && hasErrors && (
                  <tr key={`${entry.id}-errors`}>
                    <td colSpan={8} className="p-0">
                      <div className="border-t border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-6 py-3">
                        <p className="mb-2 text-xs font-medium text-red-700 dark:text-red-400">Error Details</p>
                        <div className="space-y-1">
                          {(entry.errors as { messageId: string; error: string }[]).map((err, i) => (
                            <div key={i} className="text-xs text-red-600 dark:text-red-400">
                              <span className="font-mono">{err.messageId}:</span> {err.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expanded rejection details */}
                {expandedId === entry.id && expandedType === 'rejections' && hasRejections && (
                  <tr key={`${entry.id}-rejections`}>
                    <td colSpan={8} className="p-0">
                      <div className="border-t border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 px-6 py-3">
                        <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-400">Rejected Emails</p>
                        <div className="space-y-1">
                          {rejections.map((rej, i) => (
                            <div key={i} className="text-xs text-amber-600 dark:text-amber-400">
                              <span className="font-mono">{rej.messageId}:</span> {rej.reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expanded message details */}
                {expandedId === entry.id && expandedType === 'details' && hasDetails && (
                  <tr key={`${entry.id}-details`}>
                    <td colSpan={8} className="p-0">
                      <div className="border-t border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 px-6 py-3">
                        <p className="mb-3 text-xs font-medium text-indigo-700 dark:text-indigo-400">Message Details</p>
                        <div className="space-y-2">
                          {details.map((detail, i) => {
                            const badge = ACTION_BADGE_CONFIG[detail.action] || ACTION_BADGE_CONFIG.error
                            const ticketMatch = detail.ticketNumber?.match(/TKT-\d{4}-\d{4,}/)

                            return (
                              <div
                                key={i}
                                className="flex items-start gap-3 text-xs rounded-md border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                              >
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${badge.color} ${badge.bg} ${badge.darkColor} ${badge.darkBg}`}>
                                  {badge.label}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {detail.sender && (
                                      <span className="font-mono text-slate-600 dark:text-slate-300">{detail.sender}</span>
                                    )}
                                    {detail.senderName && detail.senderName !== detail.sender && (
                                      <span className="text-slate-400 dark:text-slate-500">({detail.senderName})</span>
                                    )}
                                  </div>
                                  {detail.subject && (
                                    <div className="text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                      {detail.subject}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0 max-w-[200px]">
                                  {ticketMatch ? (
                                    <Link
                                      href={`/helpdesk?search=${ticketMatch[0]}`}
                                      className="text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      {ticketMatch[0]}
                                    </Link>
                                  ) : (
                                    <span className="text-slate-500 dark:text-slate-400">{detail.reason}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                No poll cycles recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
