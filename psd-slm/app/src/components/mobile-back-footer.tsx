'use client'

import Link from 'next/link'
import { useSidebar } from '@/components/sidebar-provider'

export function MobileBackFooter() {
  const { isMobile } = useSidebar()

  if (!isMobile) return null

  return (
    <div className="mt-10 pb-6">
      <Link
        href="/"
        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 no-underline text-slate-600 dark:text-slate-300 active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
        </svg>
        <span className="text-sm font-medium">Main Menu</span>
      </Link>
    </div>
  )
}
