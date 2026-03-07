'use client'

import Link from 'next/link'

export function MobileHeader({ portalLogoUrl }: { portalLogoUrl?: string | null }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 md:hidden">
      <Link
        href="/"
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
        aria-label="Main menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
        </svg>
      </Link>
      <img src={portalLogoUrl || '/innov8iv-logo.png'} alt={portalLogoUrl ? 'Logo' : 'Innov8iv'} className="h-6 w-auto" />
    </div>
  )
}
