'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { EMAIL_DIRECTION_CONFIG } from '@/lib/email/types'
import type { TicketEmail } from '@/lib/email/types'

interface Props {
  emails: TicketEmail[]
}

export function EmailThreadSection({ emails }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (emails.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Email Thread</span>
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
            {emails.length}
          </span>
        </div>
        <svg className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700/50">
          {emails.map(email => (
            <EmailCard key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmailCard({ email }: { email: TicketEmail }) {
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const directionCfg = EMAIL_DIRECTION_CONFIG[email.direction]

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge label={directionCfg.label} color={directionCfg.color} bg={directionCfg.bg} />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {email.from_name || email.from_address}
          </span>
          {email.from_name && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              &lt;{email.from_address}&gt;
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
          {email.sent_at ? new Date(email.sent_at).toLocaleString('en-GB') : '—'}
        </span>
      </div>

      {/* To/CC */}
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-400 dark:text-slate-500">
        <span>
          To: {email.to_addresses.map(a => a.name || a.address).join(', ')}
        </span>
        {email.cc_addresses.length > 0 && (
          <span>
            CC: {email.cc_addresses.map(a => a.name || a.address).join(', ')}
          </span>
        )}
      </div>

      {/* Subject */}
      {email.subject && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          <span className="text-slate-400 dark:text-slate-500">Subject:</span> {email.subject}
        </p>
      )}

      {/* Body preview / full */}
      <div className="mt-2">
        {bodyExpanded ? (
          <div className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-3">
            {email.body_html ? (
              <div
                className="prose prose-sm max-w-none text-xs text-slate-700 dark:text-slate-300"
                dangerouslySetInnerHTML={{ __html: email.body_html }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">
                {email.body_text}
              </pre>
            )}
            <button
              onClick={() => setBodyExpanded(false)}
              className="mt-2 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Collapse
            </button>
          </div>
        ) : (
          <button
            onClick={() => setBodyExpanded(true)}
            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Show email body
          </button>
        )}
      </div>

      {/* Attachments */}
      {email.has_attachments && email.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {email.attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-md bg-gray-100 dark:bg-slate-700 px-2 py-1">
              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-[10px] text-slate-600 dark:text-slate-400">{att.name}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                ({Math.round(att.size / 1024)}KB)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Processing notes */}
      {email.processing_notes && (
        <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 italic">
          {email.processing_notes}
        </p>
      )}
    </div>
  )
}
