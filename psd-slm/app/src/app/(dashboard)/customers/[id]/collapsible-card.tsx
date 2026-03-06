'use client'

import { useState } from 'react'

interface CollapsibleCardProps {
  title: string
  count?: number
  actions?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

export function CollapsibleCard({ title, count, actions, children, defaultOpen = true }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 mb-6">
      <div className="flex items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-left"
        >
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
            {title}
            {count !== undefined && (
              <span className="ml-2 text-xs font-normal text-slate-400">({count})</span>
            )}
          </h3>
        </button>
        {actions && <div>{actions}</div>}
      </div>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}
