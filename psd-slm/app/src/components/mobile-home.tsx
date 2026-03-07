'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { signOut } from '@/app/auth/actions'
import type { AgentAvatars } from '@/lib/agent-avatars'

type NavTile = {
  href: string
  label: string
  icon: string
  agentKey?: keyof AgentAvatars
  agentColor?: string
  permission?: { module: string; action: string }
  adminOnly?: boolean
}

type TileSection = {
  label: string
  items: NavTile[]
}

const TILE_SECTIONS: TileSection[] = [
  {
    label: '',
    items: [
      { href: '/?view=dashboard', label: 'Dashboard', icon: '📊' },
    ],
  },
  {
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
    label: 'Purchasing',
    items: [
      { href: '/products', label: 'Products', icon: '🏷️', permission: { module: 'products', action: 'view' } },
      { href: '/suppliers', label: 'Suppliers', icon: '📦', permission: { module: 'suppliers', action: 'view' } },
      { href: '/inbound-pos', label: 'Customer POs', icon: '📥', permission: { module: 'inbound_pos', action: 'view' } },
      { href: '/orders', label: 'Sales Orders', icon: '📋', permission: { module: 'sales_orders', action: 'view' } },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: '📦', permission: { module: 'purchase_orders', action: 'view' } },
      { href: '/invoices', label: 'Invoices', icon: '🧾', permission: { module: 'invoices', action: 'view' } },
      { href: '/stock', label: 'Stock', icon: '📊', permission: { module: 'stock', action: 'view' } },
      { href: '/delivery-notes', label: 'Delivery Notes', icon: '🚚', permission: { module: 'delivery_notes', action: 'view' } },
      { href: '/collections', label: 'Collections', icon: '📋', permission: { module: 'collections', action: 'view' } },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/helpdesk', label: 'Service Desk', icon: '🎫', permission: { module: 'helpdesk', action: 'view' } },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      { href: '/scheduling', label: 'Scheduling', icon: '📅', permission: { module: 'scheduling', action: 'view' } },
      { href: '/visit-scheduling', label: 'Schedule Planner', icon: '🗓️', permission: { module: 'visit_scheduling', action: 'view' } },
    ],
  },
  {
    label: 'Agents',
    items: [
      { href: '/agents/helen', label: 'Helen', icon: '💜', agentKey: 'helen', agentColor: '#8b5cf6' },
      { href: '/agents/jasper', label: 'Jasper', icon: '💙', agentKey: 'jasper', agentColor: '#3b82f6' },
      { href: '/agents/lucia', label: 'Lucia', icon: '💚', agentKey: 'lucia', agentColor: '#10b981' },
    ],
  },
  {
    label: 'Customer Portal',
    items: [
      { href: '/portal-preview', label: 'Customer Portal', icon: '🌐', adminOnly: true },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/team', label: 'Team', icon: '👥', permission: { module: 'team', action: 'view' } },
      { href: '/settings', label: 'System Settings', icon: '⚙️', adminOnly: true },
    ],
  },
]

function AgentTileAvatar({ url, name, color }: { url: string | null; name: string; color: string }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white overflow-hidden"
      style={{ width: 36, height: 36, backgroundColor: color, fontSize: 14 }}
    >
      {url && !imgError ? (
        <img src={url} alt={name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        name[0]
      )}
    </div>
  )
}

function UserTileAvatar({ user }: { user: { firstName: string; lastName: string; initials: string | null; color: string | null; avatarUrl: string | null } }) {
  const [imgError, setImgError] = useState(false)
  const initials = user.initials || (user.firstName[0] + user.lastName[0])
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white overflow-hidden"
      style={{ width: 36, height: 36, backgroundColor: user.color || '#6366f1' }}
    >
      {user.avatarUrl && !imgError ? (
        <img src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} className="h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        initials
      )}
    </div>
  )
}

interface MobileHomeProps {
  agentAvatars?: AgentAvatars
}

export function MobileHome({ agentAvatars }: MobileHomeProps) {
  const { user, hasPermission } = useAuth()

  const isVisible = (item: NavTile) => {
    if (item.adminOnly) return ['super_admin', 'admin'].includes(user.role.name)
    if (!item.permission) return true
    return hasPermission(item.permission.module, item.permission.action)
  }

  const visibleSections = TILE_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter(isVisible),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div className="space-y-6 pb-20 max-w-full overflow-hidden">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Welcome, {user.firstName}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          What would you like to do?
        </p>
      </div>

      {visibleSections.map((section, idx) => (
        <div key={section.label || `section-${idx}`}>
          {section.label && (
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-3 px-1">
              {section.label}
            </h2>
          )}
          <div className={section.label === '' ? '' : 'grid grid-cols-3 gap-3'}>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 no-underline text-slate-700 dark:text-slate-200 active:scale-95 active:bg-slate-50 dark:active:bg-slate-700 transition-transform min-w-0 ${
                  section.label === ''
                    ? 'flex-row p-3.5'
                    : 'flex-col p-3 min-h-[80px]'
                }`}
              >
                {item.agentKey ? (
                  <AgentTileAvatar
                    url={agentAvatars?.[item.agentKey] ?? null}
                    name={item.label}
                    color={item.agentColor!}
                  />
                ) : (
                  <span className={section.label === '' ? 'text-lg' : 'text-2xl'}>{item.icon}</span>
                )}
                <span className={section.label === ''
                  ? 'text-sm font-semibold'
                  : 'text-[11px] font-medium text-center leading-tight'
                }>
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Bottom bar — user profile + logout */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex min-w-0 flex-1 items-center gap-3 no-underline"
          >
            <UserTileAvatar user={user} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-200 truncate">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {user.role.displayName}
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <div className="h-8 w-px bg-slate-600" />
          <button
            onClick={async () => {
              await signOut()
            }}
            className="flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 hover:text-red-400 active:bg-slate-700 transition-colors"
            title="Log out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
