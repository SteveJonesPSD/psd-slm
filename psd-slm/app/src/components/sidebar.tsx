'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { signOut } from '@/app/auth/actions'

type NavLink = {
  href: string
  label: string
  icon: string
  permission?: { module: string; action: string }
}
type NavDivider = { divider: true }
type NavItem = NavLink | NavDivider

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/customers', label: 'Customers', icon: '🏢', permission: { module: 'customers', action: 'view' } },
  { href: '/pipeline', label: 'Pipeline', icon: '📈', permission: { module: 'pipeline', action: 'view' } },
  { href: '/quotes', label: 'Quotes', icon: '📄', permission: { module: 'quotes', action: 'view' } },
  { href: '/products', label: 'Products', icon: '🏷️', permission: { module: 'products', action: 'view' } },
  { href: '/suppliers', label: 'Suppliers', icon: '📦', permission: { module: 'suppliers', action: 'view' } },
  { href: '/deal-registrations', label: 'Deal Regs', icon: '🤝', permission: { module: 'deal_registrations', action: 'view' } },
  { divider: true },
  { href: '/orders', label: 'Sales Orders', icon: '📋', permission: { module: 'sales_orders', action: 'view' } },
  { divider: true },
  { href: '/team', label: 'Team', icon: '👥', permission: { module: 'team', action: 'view' } },
]

function isDivider(item: NavItem): item is NavDivider {
  return 'divider' in item
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { user, hasPermission } = useAuth()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    // Pipeline nav item should also highlight for /opportunities/* routes
    if (href === '/pipeline' && pathname.startsWith('/opportunities')) return true
    return pathname.startsWith(href)
  }

  // Filter nav items based on permissions
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (isDivider(item)) return true
    if (!item.permission) return true
    return hasPermission(item.permission.module, item.permission.action)
  })

  // Remove leading/trailing/consecutive dividers
  const cleanedItems = visibleItems.filter((item, i, arr) => {
    if (!isDivider(item)) return true
    if (i === 0 || i === arr.length - 1) return false
    if (isDivider(arr[i - 1])) return false
    return true
  })

  return (
    <div
      className="flex flex-col bg-slate-900 text-slate-400 transition-all duration-200 shrink-0 overflow-hidden"
      style={{ width: collapsed ? 60 : 230 }}
    >
      {/* Logo / Brand */}
      <div
        className="flex items-center gap-2.5 border-b border-slate-800 cursor-pointer min-h-[60px]"
        style={{ padding: collapsed ? '18px 12px' : '18px 20px' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-[11px]">i8</span>
        </div>
        {!collapsed && (
          <div>
            <div className="text-[15px] font-bold text-slate-50 whitespace-nowrap">
              Innov8iv Engage
            </div>
            <div className="text-[10px] text-slate-600 uppercase tracking-wider">
              Sales Lifecycle
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {cleanedItems.map((item, i) => {
          if (isDivider(item)) {
            return (
              <div key={`d-${i}`} className="h-px bg-slate-800 mx-2 my-2.5" />
            )
          }

          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm no-underline transition-colors ${
                active
                  ? 'bg-slate-800 text-slate-50 font-semibold'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {!collapsed && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer — User + Sign Out */}
      <div className="border-t border-slate-800 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: user.color || '#6366f1' }}
            >
              {user.initials || (user.firstName[0] + user.lastName[0])}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-300">
                {user.firstName} {user.lastName}
              </div>
              <div className="truncate text-[10px] text-slate-600">
                {user.role.displayName}
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-slate-600 hover:text-slate-300 transition-colors"
                title="Sign out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </form>
          </div>
        ) : (
          <form action={signOut} className="flex justify-center">
            <button
              type="submit"
              className="text-slate-600 hover:text-slate-300 transition-colors"
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
