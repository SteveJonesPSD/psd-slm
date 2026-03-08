'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { OJI_STATUS_CONFIG, OJI_PRIORITY_CONFIG } from '@/lib/onsite-jobs/types'
import type { OnsiteJobItem, OnsiteJobCategory, OjiStatus } from '@/lib/onsite-jobs/types'

interface OnsiteJobsListProps {
  items: OnsiteJobItem[]
  categories: OnsiteJobCategory[]
  pendingCount: number
  inProgressCount: number
  escalatedCount: number
  isAdmin: boolean
  customerId?: string
  customerName?: string
  customers?: { id: string; name: string }[]
}

type FilterTab = 'open' | 'complete' | 'all'

export function OnsiteJobsList({
  items,
  categories,
  pendingCount,
  inProgressCount,
  escalatedCount,
  isAdmin,
  customerId: fixedCustomerId,
  customerName,
  customers,
}: OnsiteJobsListProps) {
  const router = useRouter()
  const [tab, setTab] = useState<FilterTab>('open')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeCustomerId = fixedCustomerId || selectedCustomerId

  const filteredCustomers = (customers || []).filter(c =>
    customerSearch ? c.name.toLowerCase().includes(customerSearch.toLowerCase()) : true
  ).slice(0, 20)

  const selectedCustomer = (customers || []).find(c => c.id === selectedCustomerId)

  const filtered = items.filter(item => {
    if (activeCustomerId && item.customer_id !== activeCustomerId) return false
    if (tab === 'open') return ['pending', 'in_progress', 'escalated'].includes(item.status)
    if (tab === 'complete') return item.status === 'complete'
    return true
  })

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-12">
        <div>
          {fixedCustomerId && (
            <Link href="/helpdesk/onsite-jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 no-underline mb-2 block">
              &larr; All Onsite Jobs
            </Link>
          )}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {customerName ? `Onsite Jobs — ${customerName}` : selectedCustomer ? `Onsite Jobs — ${selectedCustomer.name}` : 'Onsite Jobs'}
          </h1>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          {activeCustomerId && (
            <Link
              href={`/customers/${activeCustomerId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:shadow-[0_0_12px_rgba(59,130,246,0.4)] transition-shadow no-underline"
            >
              View Customer
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/helpdesk/onsite-jobs/config"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-500/30 bg-slate-500/15 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:shadow-[0_0_12px_rgba(100,116,139,0.4)] transition-shadow no-underline"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Config
            </Link>
          )}
        </div>
      </div>

      {/* Customer selector */}
      {!fixedCustomerId && customers && customers.length > 0 && (
        <div className="mb-8 relative">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md" ref={dropdownRef}>
              <input
                type="text"
                placeholder="Filter by customer..."
                value={selectedCustomer ? selectedCustomer.name : customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setSelectedCustomerId('')
                  setShowCustomerDropdown(true)
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              {(selectedCustomerId || customerSearch) && (
                <button
                  onClick={() => {
                    setSelectedCustomerId('')
                    setCustomerSearch('')
                    setShowCustomerDropdown(false)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {showCustomerDropdown && !selectedCustomerId && (customerSearch.length > 0) && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                  {filteredCustomers.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">No customers found</div>
                  ) : (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id)
                          setCustomerSearch('')
                          setShowCustomerDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {!fixedCustomerId && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          <StatCard label="Pending" value={pendingCount} accent="#d97706" />
          <StatCard label="In Progress" value={inProgressCount} accent="#3b82f6" />
          <StatCard label="Escalated" value={escalatedCount} accent="#ef4444" />
        </div>
      )}

      {/* Tab filter */}
      <div className="flex items-center gap-2 mb-8">
        {(['open', 'complete', 'all'] as FilterTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            {t === 'open' ? 'Open' : t === 'complete' ? 'Complete' : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Subject</th>
                {!fixedCustomerId && (
                  <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Customer</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Room</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Logged</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Next Visit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const statusCfg = OJI_STATUS_CONFIG[item.status]
                const priorityCfg = OJI_PRIORITY_CONFIG[item.priority]
                const cat = item.category as OnsiteJobCategory | null
                return (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/helpdesk/onsite-jobs/${item.id}`)}
                    className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{item.ref_number}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-200 max-w-[250px] truncate">{item.subject}</td>
                    {!fixedCustomerId && (
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{item.customer?.name || '—'}</td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{item.room_location || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {cat ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: `${cat.colour || '#6b7280'}18`, color: cat.colour || '#6b7280' }}
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.colour || '#6b7280' }} />
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                      {item.visit_instance?.visit_date
                        ? new Date(item.visit_instance.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={fixedCustomerId ? 8 : 9} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                    {tab === 'open' ? 'No open onsite jobs' : tab === 'complete' ? 'No completed jobs yet' : 'No onsite jobs found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
