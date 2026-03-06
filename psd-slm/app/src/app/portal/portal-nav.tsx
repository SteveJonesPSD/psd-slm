'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePortal } from './portal-context'

const NAV_ITEMS = [
  { href: '/portal/dashboard', label: 'Dashboard' },
  { href: '/portal/quotes', label: 'Quotes' },
  { href: '/portal/orders', label: 'Orders' },
  { href: '/portal/invoices', label: 'Invoices' },
  { href: '/portal/helpdesk', label: 'Support' },
  { href: '/portal/visits', label: 'Visits' },
  { href: '/portal/contracts', label: 'Contracts' },
  { href: '/portal/contacts', label: 'Contacts' },
]

export function PortalNav() {
  const pathname = usePathname()
  const ctx = usePortal()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30">
      {ctx.isImpersonation && (
        <div className="bg-amber-500 text-white text-center text-xs font-medium py-1.5 px-4">
          Impersonation mode — viewing as <strong>{ctx.displayName}</strong> at {ctx.customerName}
          <span className="mx-2">·</span>
          <a href="/" className="underline hover:no-underline">Back to Dashboard</a>
        </div>
      )}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
        {/* Logo + Portal label */}
        <Link href="/portal/dashboard" className="flex items-center gap-2.5 no-underline">
          {ctx.portalLogoUrl ? (
            <img src={ctx.portalLogoUrl} alt={ctx.orgName || 'Logo'} className="h-8 w-auto" />
          ) : (
            <img src="/innov8iv-logo.png" alt="Innov8iv Engage" className="h-8 w-auto" />
          )}
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 hidden sm:block">{ctx.orgName || 'Customer Portal'}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm no-underline transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User + sign out */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{ctx.displayName}</div>
            <div className="text-[11px] text-slate-400">{ctx.customerName}</div>
          </div>
          <form action="/api/portal/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1"
            >
              Sign Out
            </button>
          </form>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm no-underline ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
            <div className="text-xs text-slate-500 dark:text-slate-400 px-3 py-1">{ctx.displayName} &middot; {ctx.customerName}</div>
          </div>
        </div>
      )}
      </div>
    </header>
  )
}
