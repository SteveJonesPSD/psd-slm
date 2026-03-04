'use client'

import { useSidebar } from './sidebar-provider'

export function MobileHeader() {
  const { toggleMobileOpen } = useSidebar()

  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 md:hidden">
      <button
        onClick={toggleMobileOpen}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
        aria-label="Open menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <img src="/innov8iv-logo.png" alt="Innov8iv" className="h-6 w-auto" />
    </div>
  )
}
