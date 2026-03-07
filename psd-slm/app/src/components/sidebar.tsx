'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useSidebar } from '@/components/sidebar-provider'
import { signOut } from '@/app/auth/actions'
import { NotificationBell } from '@/components/notification-bell'
import { OnlineAvatars } from '@/components/online-avatars'
import { useSystemPresence } from '@/components/use-system-presence'
import { createClient } from '@/lib/supabase/client'
import type { AgentAvatars } from '@/lib/agent-avatars'

type NavLink = {
  href: string
  label: string
  icon: string
  permission?: { module: string; action: string }
  adminOnly?: boolean
  badgeKey?: string
}

type NavSection = {
  key: string
  label: string
  items: NavLink[]
}

const TOP_ITEMS: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
]

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'sales',
    label: 'Sales',
    items: [
      { href: '/customers', label: 'Customers', icon: '🏢', permission: { module: 'customers', action: 'view' } },
      { href: '/pipeline', label: 'Pipeline', icon: '📈', permission: { module: 'pipeline', action: 'view' } },
      { href: '/quotes', label: 'Quotes', icon: '📄', permission: { module: 'quotes', action: 'view' } },
      { href: '/templates', label: 'Templates', icon: '📑', permission: { module: 'templates', action: 'view' } },
      { href: '/contracts', label: 'Contracts', icon: '📋', permission: { module: 'contracts', action: 'view' } },
      { href: '/deal-registrations', label: 'Deal Regs', icon: '🤝', permission: { module: 'deal_registrations', action: 'view' } },
    ],
  },
  {
    key: 'purchasing',
    label: 'Purchasing',
    items: [
      { href: '/products', label: 'Products', icon: '🏷️', permission: { module: 'products', action: 'view' } },
      { href: '/suppliers', label: 'Suppliers', icon: '📦', permission: { module: 'suppliers', action: 'view' } },
      { href: '/inbound-pos', label: 'Customer POs', icon: '📥', permission: { module: 'inbound_pos', action: 'view' }, badgeKey: 'inbound_pos' },
      { href: '/orders', label: 'Sales Orders', icon: '📋', permission: { module: 'sales_orders', action: 'view' } },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: '📦', permission: { module: 'purchase_orders', action: 'view' } },
      { href: '/invoices', label: 'Invoices', icon: '🧾', permission: { module: 'invoices', action: 'view' } },
      { href: '/stock', label: 'Stock', icon: '📊', permission: { module: 'stock', action: 'view' } },
      { href: '/delivery-notes', label: 'Delivery Notes', icon: '🚚', permission: { module: 'delivery_notes', action: 'view' } },
      { href: '/collections', label: 'Collections', icon: '📋', permission: { module: 'collections', action: 'view' } },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    items: [
      { href: '/helpdesk', label: 'Service Desk', icon: '🎫', permission: { module: 'helpdesk', action: 'view' }, badgeKey: 'helpdesk' },
      { href: '/scheduling', label: 'Scheduling', icon: '📅', permission: { module: 'scheduling', action: 'view' } },
      { href: '/visit-scheduling', label: 'Visit Calendar', icon: '🗓️', permission: { module: 'visit_scheduling', action: 'view' } },
    ],
  },
  {
    key: 'agents',
    label: 'Agents',
    items: [
      { href: '/agents/helen', label: 'Helen', icon: '💜' },
      { href: '/agents/jasper', label: 'Jasper', icon: '💙' },
      { href: '/agents/lucia', label: 'Lucia', icon: '💚' },
    ],
  },
]

const BOTTOM_ITEMS: NavLink[] = [
  { href: '/portal-preview', label: 'Portal Preview', icon: '🌐', adminOnly: true },
  { href: '/team', label: 'Team', icon: '👥', permission: { module: 'team', action: 'view' } },
  { href: '/settings', label: 'Settings', icon: '⚙️', adminOnly: true },
]

function usePolledCount(enabled: boolean, fetcher: () => Promise<number>) {
  const [count, setCount] = useState(0)
  const lastCountRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const fetchCount = async () => {
      try {
        const c = await fetcher()
        if (!cancelled && c !== lastCountRef.current) {
          lastCountRef.current = c
          setCount(c)
        }
      } catch { /* ignore */ }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [enabled, fetcher])

  return count
}

function useSectionState(key: string, defaultOpen: boolean) {
  const storageKey = `sidebar-section-${key}`
  // Initialize from localStorage synchronously to avoid flash, fall back to default
  const [open, setOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) return stored === 'true'
    }
    return defaultOpen
  })

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(storageKey, String(next))
      return next
    })
  }, [storageKey])

  const forceOpen = useCallback(() => {
    setOpen(true)
    localStorage.setItem(storageKey, 'true')
  }, [storageKey])

  return { open, toggle, forceOpen }
}

export function Sidebar({ agentAvatars, portalLogoUrl }: { agentAvatars?: AgentAvatars; portalLogoUrl?: string | null }) {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, isMobile } = useSidebar()
  const { user, hasPermission } = useAuth()

  // On mobile, sidebar is always expanded (never icon-only)
  const effectiveCollapsed = isMobile ? false : collapsed

  const hasPOPermission = hasPermission('inbound_pos', 'view')
  const hasHelpdeskPermission = hasPermission('helpdesk', 'view')
  const pendingPOFetcher = useMemo(() => async () => {
    const supabase = createClient()
    const { count } = await supabase
      .from('inbound_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending_review', 'matched'])
    return count || 0
  }, [])
  const helpdeskFetcher = useMemo(() => async () => {
    const res = await fetch('/api/helpdesk/badge-count')
    if (!res.ok) return 0
    const data = await res.json()
    return data.count || 0
  }, [])
  const pendingPOCount = usePolledCount(hasPOPermission, pendingPOFetcher)
  const newTicketCount = usePolledCount(hasHelpdeskPermission, helpdeskFetcher)
  const onlineUsers = useSystemPresence()

  const agentAvatarMap: Record<string, string | null> = {
    '/agents/helen': agentAvatars?.helen ?? null,
    '/agents/jasper': agentAvatars?.jasper ?? null,
    '/agents/lucia': agentAvatars?.lucia ?? null,
  }

  // Close drawer on pathname change (mobile)
  useEffect(() => {
    if (isMobile) setMobileOpen(false)
  }, [pathname, isMobile, setMobileOpen])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/pipeline' && pathname.startsWith('/opportunities')) return true
    if (href === '/scheduling' && pathname.startsWith('/scheduling')) return true
    return pathname.startsWith(href)
  }

  const isItemVisible = (item: NavLink) => {
    if (item.adminOnly) return ['super_admin', 'admin'].includes(user.role.name)
    if (!item.permission) return true
    return hasPermission(item.permission.module, item.permission.action)
  }

  const getBadgeCount = (item: NavLink) => {
    if (item.badgeKey === 'inbound_pos') return pendingPOCount
    if (item.badgeKey === 'helpdesk') return newTicketCount
    return 0
  }

  // Determine which sections have any visible items
  const visibleSections = NAV_SECTIONS.filter((section) =>
    section.items.some(isItemVisible)
  )

  const visibleBottomItems = BOTTOM_ITEMS.filter(isItemVisible)

  // Check if a section contains the currently active route
  const sectionContainsActive = (section: NavSection) =>
    section.items.some((item) => isItemVisible(item) && isActive(item.href))

  const handleLogoClick = () => {
    if (isMobile) {
      setMobileOpen(false)
    } else {
      toggleCollapsed()
    }
  }

  const sidebarWidth = isMobile ? 280 : (effectiveCollapsed ? 60 : 230)

  return (
    <>
      {/* Backdrop overlay — mobile only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:relative flex flex-col bg-slate-900 text-slate-400 transition-all duration-200 shrink-0 overflow-hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ width: sidebarWidth }}
      >
        {/* Logo / Brand */}
        <div
          className="flex items-center justify-center border-b border-slate-800 cursor-pointer min-h-[60px]"
          style={{ padding: effectiveCollapsed ? '14px 8px' : '14px 16px' }}
          onClick={handleLogoClick}
        >
          {effectiveCollapsed ? (
            portalLogoUrl ? (
              <img src={portalLogoUrl} alt="Logo" className="h-8 w-8 object-contain shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-[11px]">i8</span>
              </div>
            )
          ) : (
            <img src={portalLogoUrl || '/innov8iv-logo.png'} alt={portalLogoUrl ? 'Logo' : 'Innov8iv'} className="h-8 w-auto" />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Top-level items (Dashboard) */}
          {TOP_ITEMS.filter(isItemVisible).map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={effectiveCollapsed}
              badgeCount={getBadgeCount(item)}
            />
          ))}

          {visibleSections.map((section) => (
            <SidebarSection
              key={section.key}
              section={section}
              collapsed={effectiveCollapsed}
              isActive={isActive}
              isItemVisible={isItemVisible}
              getBadgeCount={getBadgeCount}
              containsActive={sectionContainsActive(section)}
              agentAvatarMap={agentAvatarMap}
            />
          ))}

          {/* Divider before bottom items */}
          {visibleBottomItems.length > 0 && (
            <div className="h-px bg-slate-800 mx-2 my-2.5" />
          )}

          {/* Bottom items (Team, Settings) — always visible, no section header */}
          {visibleBottomItems.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={effectiveCollapsed}
              badgeCount={getBadgeCount(item)}
            />
          ))}
        </nav>

        {/* Online Users */}
        {onlineUsers.length > 0 && (
          <div className="border-t border-slate-800">
            <OnlineAvatars users={onlineUsers} collapsed={effectiveCollapsed} />
          </div>
        )}

        {/* Notifications */}
        <div className="px-2 pb-1">
          <NotificationBell collapsed={effectiveCollapsed} />
        </div>

        {/* Footer — User + Sign Out */}
        <div className="border-t border-slate-800 p-3">
          {!effectiveCollapsed ? (
            <div className="flex items-center gap-2.5">
              <Link href="/profile" className="flex items-center gap-2.5 min-w-0 flex-1 no-underline group">
                <UserAvatar user={user} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="truncate text-[10px] text-slate-600">
                    {user.role.displayName}
                  </div>
                </div>
              </Link>
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
    </>
  )
}

function SidebarSection({
  section,
  collapsed,
  isActive,
  isItemVisible,
  getBadgeCount,
  containsActive,
  agentAvatarMap,
}: {
  section: NavSection
  collapsed: boolean
  isActive: (href: string) => boolean
  isItemVisible: (item: NavLink) => boolean
  getBadgeCount: (item: NavLink) => number
  containsActive: boolean
  agentAvatarMap: Record<string, string | null>
}) {
  const { open, toggle, forceOpen } = useSectionState(section.key, false)

  // Auto-expand if the section contains the active route
  useEffect(() => {
    if (containsActive && !open) {
      forceOpen()
    }
  }, [containsActive, open, forceOpen])

  const visibleItems = section.items.filter(isItemVisible)
  if (visibleItems.length === 0) return null

  // In collapsed mode, just show the icons — no section headers
  if (collapsed) {
    return (
      <>
        {visibleItems.map((item) => (
          <NavItemLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
            badgeCount={getBadgeCount(item)}
            avatarUrl={agentAvatarMap[item.href]}
          />
        ))}
      </>
    )
  }

  // Total badge count for the section (shown when collapsed)
  const sectionBadgeTotal = visibleItems.reduce((sum, item) => sum + getBadgeCount(item), 0)

  return (
    <div>
      {/* Section header */}
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full px-3.5 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {section.label}
          {!open && sectionBadgeTotal > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white normal-case tracking-normal">
              {sectionBadgeTotal > 99 ? '99+' : sectionBadgeTotal}
            </span>
          )}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Section items */}
      {open && (
        <div className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
              badgeCount={getBadgeCount(item)}
              avatarUrl={agentAvatarMap[item.href]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NavItemLink({
  item,
  active,
  collapsed,
  badgeCount,
  avatarUrl,
}: {
  item: NavLink
  active: boolean
  collapsed: boolean
  badgeCount: number
  avatarUrl?: string | null
}) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm no-underline transition-colors ${
        active
          ? 'bg-slate-800 text-slate-50 font-semibold'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      <span className="text-base w-5 text-center relative">
        {avatarUrl ? (
          <SidebarAgentAvatar url={avatarUrl} name={item.label} fallbackIcon={item.icon} />
        ) : (
          item.icon
        )}
        {collapsed && badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="whitespace-nowrap flex-1 flex items-center justify-between">
          {item.label}
          {badgeCount > 0 && (
            <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[10px] font-bold text-white">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </span>
      )}
    </Link>
  )
}

function SidebarAgentAvatar({ url, name, fallbackIcon }: { url: string; name: string; fallbackIcon: string }) {
  const [imgError, setImgError] = useState(false)
  if (imgError) return <>{fallbackIcon}</>
  return (
    <img
      src={url}
      alt={name}
      className="w-5 h-5 rounded-full object-cover"
      onError={() => setImgError(true)}
    />
  )
}

function UserAvatar({ user, size }: { user: { firstName: string; lastName: string; initials: string | null; color: string | null; avatarUrl: string | null }; size: number }) {
  const [imgError, setImgError] = useState(false)
  const initials = user.initials || (user.firstName[0] + user.lastName[0])
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white overflow-hidden"
      style={{ width: size, height: size, backgroundColor: user.color || '#6366f1' }}
    >
      {user.avatarUrl && !imgError ? (
        <img src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} className="h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        initials
      )}
    </div>
  )
}
