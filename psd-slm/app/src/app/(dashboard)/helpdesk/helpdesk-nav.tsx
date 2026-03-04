'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useCallback } from 'react'

interface HelpdeskNavProps {
  isAdmin: boolean
  tags: { id: string; name: string; color: string }[]
}

const mainLinks = [
  { href: '/helpdesk', label: 'Ticket Queue', exact: true },
  { href: '/helpdesk/dashboard', label: 'Dashboard' },
  { href: '/helpdesk/onsite', label: 'Onsite Jobs' },
  { href: '/helpdesk/knowledge-base', label: 'Knowledge Base' },
  { href: '/helpdesk/reports', label: 'Reports' },
  { href: '/helpdesk/reports/assist-usage', label: 'AI Assist Usage', adminOnly: true },
  { href: '/helpdesk/tickets/new', label: 'New Ticket' },
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

export function HelpdeskNav({ isAdmin, tags }: HelpdeskNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  // Only show tag filter on the ticket queue page
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
    <div className="w-full md:w-[200px] shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/50 p-4 flex flex-col">
      <div className="mb-4">
        <h3 className="hidden md:block mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Service Desk
        </h3>
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {mainLinks
            .filter((link) => !('adminOnly' in link && link.adminOnly) || isAdmin)
            .map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block shrink-0 whitespace-nowrap md:whitespace-normal rounded-md px-3 py-1.5 text-sm no-underline transition-colors ${
                isActive(link.href, 'exact' in link ? link.exact : undefined)
                  ? 'bg-white font-medium text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {isAdmin && (
        <div className="mb-4">
          <h3 className="hidden md:block mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Configuration
          </h3>
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {configLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block shrink-0 whitespace-nowrap md:whitespace-normal rounded-md px-3 py-1.5 text-sm no-underline transition-colors ${
                  isActive(link.href)
                    ? 'bg-white font-medium text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Tag filter — only on the queue page */}
      {isQueuePage && tags.length > 0 && (
        <div className="hidden md:block mt-auto pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Filter by Tag
            </h3>
            {selectedTagIds.length > 0 && (
              <button
                onClick={clearTags}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
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
        </div>
      )}
    </div>
  )
}
