'use client'

import Link from 'next/link'

export function MobileNewTicketHeader() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Link
        href="/helpdesk"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-gray-100 no-underline"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </Link>
      <h1 className="text-lg font-bold text-slate-900">New Ticket</h1>
    </div>
  )
}
