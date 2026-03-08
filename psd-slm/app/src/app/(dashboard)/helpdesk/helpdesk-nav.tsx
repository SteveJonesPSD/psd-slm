'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface HelpdeskNavProps {
  isAdmin: boolean
  tags: { id: string; name: string; color: string }[]
}

const mainLinks = [
  { href: '/helpdesk', label: 'Ticket Queue', exact: true },
  { href: '/helpdesk/tickets/new', label: 'New Ticket' },
  { href: '/helpdesk/dashboard', label: 'Dashboard' },
  { href: '/helpdesk/onsite-jobs', label: 'Onsite Jobs' },
  { href: '/helpdesk/knowledge-base', label: 'Knowledge Base' },
  { href: '/helpdesk/reports', label: 'Reports', exact: true },
  { href: '/helpdesk/reports/assist-usage', label: 'AI Assist Usage', adminOnly: true },
] as const

const configLinks = [
  { href: '/helpdesk/categories', label: 'Categories' },
  { href: '/helpdesk/departments', label: 'Departments' },
  { href: '/helpdesk/tags', label: 'Tags' },
  { href: '/helpdesk/macros', label: 'Automation' },
  { href: '/helpdesk/helen', label: 'Helen AI' },
  { href: '/helpdesk/canned-responses', label: 'Canned Responses' },
  { href: '/helpdesk/sla', label: 'SLA Plans' },
  { href: '/helpdesk/contracts', label: 'Contracts' },
]

function ChevronSvg({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function DropdownMenu({ label, links, isActive, open, onToggle, menuRef }: {
  label: string
  links: { href: string; label: string; exact?: boolean }[]
  isActive: (href: string, exact?: boolean) => boolean
  open: boolean
  onToggle: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  const hasActivePage = links.some((link) => isActive(link.href, link.exact))

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
          hasActivePage
            ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
        }`}
      >
        {label}
        <ChevronSvg open={open} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-1.5 text-sm no-underline transition-colors ${
                isActive(link.href, link.exact)
                  ? 'bg-blue-50 dark:bg-blue-900/30 font-medium text-blue-700 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function HelpdeskNav({ isAdmin, tags }: HelpdeskNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [openMenu, setOpenMenu] = useState<'main' | 'config' | 'tags' | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const configRef = useRef<HTMLDivElement>(null)
  const tagsRef = useRef<HTMLDivElement>(null)

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const refs = [mainRef, configRef, tagsRef]
      const clickedInside = refs.some(
        (ref) => ref.current && ref.current.contains(e.target as Node)
      )
      if (!clickedInside) setOpenMenu(null)
    }
    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenu])

  // Close on route change
  useEffect(() => {
    setOpenMenu(null)
  }, [pathname])

  const visibleMain = mainLinks.filter(
    (link) => !('adminOnly' in link && link.adminOnly) || isAdmin
  )

  // Tag filter logic — only on the queue page
  const isQueuePage = pathname === '/helpdesk'
  const selectedTagIds = searchParams.get('tags')?.split(',').filter(Boolean) || []

  const toggleTag = useCallback((tagId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const current = params.get('tags')?.split(',').filter(Boolean) || []

    let next: string[]
    if (current.includes(tagId)) {
      next = current.filter(id => id !== tagId)
    } else {
      next = [...current, tagId]
    }

    if (next.length > 0) {
      params.set('tags', next.join(','))
    } else {
      params.delete('tags')
    }

    router.push(`/helpdesk?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  const clearTags = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tags')
    router.push(`/helpdesk?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu
        label="Service Desk"
        links={visibleMain.map((l) => ({ href: l.href, label: l.label, exact: 'exact' in l ? l.exact : undefined }))}
        isActive={isActive}
        open={openMenu === 'main'}
        onToggle={() => setOpenMenu(openMenu === 'main' ? null : 'main')}
        menuRef={mainRef}
      />

      {isAdmin && (
        <DropdownMenu
          label="Configuration"
          links={configLinks}
          isActive={isActive}
          open={openMenu === 'config'}
          onToggle={() => setOpenMenu(openMenu === 'config' ? null : 'config')}
          menuRef={configRef}
        />
      )}

      {/* Tag filters dropdown — only on queue page */}
      {isQueuePage && tags.length > 0 && (
        <div ref={tagsRef} className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'tags' ? null : 'tags')}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              selectedTagIds.length > 0
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            Tag Filters
            {selectedTagIds.length > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-blue-600 dark:bg-blue-500 text-[11px] font-semibold text-white px-1.5">
                {selectedTagIds.length}
              </span>
            )}
            <ChevronSvg open={openMenu === 'tags'} />
          </button>

          {openMenu === 'tags' && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-2 px-2">
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all ${
                        isSelected
                          ? 'ring-2 ring-offset-1 shadow-sm'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: `${tag.color}18`,
                        color: tag.color,
                        ...(isSelected ? { ringColor: tag.color } : {}),
                      }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  )
                })}
              </div>
              {selectedTagIds.length > 0 && (
                <button
                  onClick={clearTags}
                  className="mt-2 w-full text-center text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border-t border-gray-100 dark:border-slate-700 pt-2"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
