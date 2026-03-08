'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  getActivityLog,
  getAuthEvents,
  getEngagementSummary,
  getRecentFailures,
  type ActivityLogFilters,
  type AuthEventFilters,
} from '@/lib/audit-log'

interface OrgUser {
  id: string
  first_name: string
  last_name: string
}

interface Props {
  users: OrgUser[]
}

type Tab = 'activity' | 'auth' | 'engagement'

const MODULE_BADGE_COLOURS: Record<string, string> = {
  quote: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  sales_order: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  purchase_order: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  invoice: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  stock: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ticket: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  session: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  settings: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  user: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  contract: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  company: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  contact: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  product: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  opportunity: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatCurrency(val: unknown): string {
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

export function AuditLogClient({ users }: Props) {
  const [tab, setTab] = useState<Tab>('activity')
  const defaults = getDefaultDateRange()

  // Activity tab state
  const [activityData, setActivityData] = useState<unknown[]>([])
  const [activityTotal, setActivityTotal] = useState(0)
  const [activityPage, setActivityPage] = useState(1)
  const [activityFilters, setActivityFilters] = useState<ActivityLogFilters>({
    dateFrom: defaults.from,
    dateTo: defaults.to,
    page: 1,
    pageSize: 50,
  })
  const [activityLoading, setActivityLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Auth tab state
  const [authData, setAuthData] = useState<unknown[]>([])
  const [authTotal, setAuthTotal] = useState(0)
  const [authPage, setAuthPage] = useState(1)
  const [authFilters, setAuthFilters] = useState<AuthEventFilters>({
    dateFrom: defaults.from,
    dateTo: defaults.to,
    page: 1,
    pageSize: 50,
  })
  const [authLoading, setAuthLoading] = useState(false)
  const [bruteForceAlert, setBruteForceAlert] = useState<{ userName: string; failureCount: number } | null>(null)

  // Engagement tab state
  const [engagementData, setEngagementData] = useState<unknown[]>([])
  const [engagementLoading, setEngagementLoading] = useState(false)
  const [engagementDates, setEngagementDates] = useState({ from: defaults.from, to: defaults.to })

  const loadActivity = useCallback(async (filters: ActivityLogFilters) => {
    setActivityLoading(true)
    const result = await getActivityLog(filters)
    if (!('error' in result)) {
      setActivityData(result.data)
      setActivityTotal(result.total)
    }
    setActivityLoading(false)
  }, [])

  const loadAuth = useCallback(async (filters: AuthEventFilters) => {
    setAuthLoading(true)
    const [result, failures] = await Promise.all([
      getAuthEvents(filters),
      getRecentFailures(),
    ])
    if (!('error' in result)) {
      setAuthData(result.data)
      setAuthTotal(result.total)
    }
    setBruteForceAlert(failures)
    setAuthLoading(false)
  }, [])

  const loadEngagement = useCallback(async (from: string, to: string) => {
    setEngagementLoading(true)
    const result = await getEngagementSummary(from, to)
    setEngagementData(result)
    setEngagementLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'activity') loadActivity(activityFilters)
    else if (tab === 'auth') loadAuth(authFilters)
    else if (tab === 'engagement') loadEngagement(engagementDates.from, engagementDates.to)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'activity', label: 'Activity' },
    { key: 'auth', label: 'Authentication' },
    { key: 'engagement', label: 'Engagement' },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-8">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'activity' && (
        <ActivityTab
          data={activityData}
          total={activityTotal}
          page={activityPage}
          loading={activityLoading}
          filters={activityFilters}
          users={users}
          expandedRow={expandedRow}
          onExpandRow={setExpandedRow}
          onFilterChange={(f) => {
            const updated = { ...activityFilters, ...f, page: 1 }
            setActivityFilters(updated)
            setActivityPage(1)
            loadActivity(updated)
          }}
          onPageChange={(p) => {
            setActivityPage(p)
            const updated = { ...activityFilters, page: p }
            setActivityFilters(updated)
            loadActivity(updated)
          }}
        />
      )}

      {tab === 'auth' && (
        <AuthTab
          data={authData}
          total={authTotal}
          page={authPage}
          loading={authLoading}
          filters={authFilters}
          users={users}
          bruteForceAlert={bruteForceAlert}
          onFilterChange={(f) => {
            const updated = { ...authFilters, ...f, page: 1 }
            setAuthFilters(updated)
            setAuthPage(1)
            loadAuth(updated)
          }}
          onPageChange={(p) => {
            setAuthPage(p)
            const updated = { ...authFilters, page: p }
            setAuthFilters(updated)
            loadAuth(updated)
          }}
        />
      )}

      {tab === 'engagement' && (
        <EngagementTab
          data={engagementData}
          loading={engagementLoading}
          dates={engagementDates}
          onDateChange={(d) => {
            setEngagementDates(d)
            loadEngagement(d.from, d.to)
          }}
        />
      )}
    </div>
  )
}

/* ── Activity Tab ── */
function ActivityTab({
  data, total, page, loading, filters, users, expandedRow, onExpandRow, onFilterChange, onPageChange,
}: {
  data: unknown[]
  total: number
  page: number
  loading: boolean
  filters: ActivityLogFilters
  users: OrgUser[]
  expandedRow: string | null
  onExpandRow: (id: string | null) => void
  onFilterChange: (f: Partial<ActivityLogFilters>) => void
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / (filters.pageSize || 50))

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-8">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From</label>
          <input type="date" value={filters.dateFrom || ''} onChange={e => onFilterChange({ dateFrom: e.target.value })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To</label>
          <input type="date" value={filters.dateTo || ''} onChange={e => onFilterChange({ dateTo: e.target.value })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">User</label>
          <select value={filters.userId || ''} onChange={e => onFilterChange({ userId: e.target.value || undefined })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200">
            <option value="">All Users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Module</label>
          <select value={filters.entityType || ''} onChange={e => onFilterChange({ entityType: e.target.value || undefined })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200">
            <option value="">All Modules</option>
            {['quote', 'sales_order', 'purchase_order', 'invoice', 'stock', 'ticket', 'session', 'contract', 'company', 'contact', 'product', 'opportunity', 'user', 'settings'].map(m => (
              <option key={m} value={m}>{formatAction(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Action</label>
          <input type="text" placeholder="Search actions..." value={filters.action || ''} onChange={e => onFilterChange({ action: e.target.value || undefined })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200 w-40" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No activity found for the selected filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {data.map((row: unknown) => {
                const r = row as Record<string, unknown>
                const user = r.user as Record<string, unknown> | null
                const details = r.details as Record<string, unknown> | null
                const isExpanded = expandedRow === (r.id as string)

                return (
                  <ActivityRow
                    key={r.id as string}
                    id={r.id as string}
                    createdAt={r.created_at as string}
                    userName={user ? `${user.first_name} ${user.last_name}` : 'System'}
                    entityType={r.entity_type as string}
                    action={r.action as string}
                    details={details}
                    isExpanded={isExpanded}
                    onToggle={() => onExpandRow(isExpanded ? null : r.id as string)}
                  />
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">{total} results</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
            <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center px-2">Page {page} of {totalPages}</span>
            <Button size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityRow({ id, createdAt, userName, entityType, action, details, isExpanded, onToggle }: {
  id: string; createdAt: string; userName: string; entityType: string; action: string
  details: Record<string, unknown> | null; isExpanded: boolean; onToggle: () => void
}) {
  const badgeClass = MODULE_BADGE_COLOURS[entityType] || 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
  const reference = extractReference(details)

  return (
    <>
      <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap" title={new Date(createdAt).toLocaleString('en-GB')}>
          {formatDate(createdAt)}
        </td>
        <td className="px-4 py-3 text-slate-900 dark:text-slate-200 font-medium">{userName}</td>
        <td className="px-4 py-3">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
            {formatAction(entityType)}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatAction(action)}</td>
        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{reference}</td>
        <td className="px-4 py-3 text-slate-400">
          <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>
      {isExpanded && details && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-gray-50/50 dark:bg-slate-800/50">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
              {Object.entries(details).map(([key, val]) => (
                <div key={key}>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{formatAction(key)}</span>
                  <p className="text-slate-900 dark:text-slate-200 mt-0.5 break-words">
                    {formatDetailValue(key, val)}
                  </p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function extractReference(details: Record<string, unknown> | null): string {
  if (!details) return ''
  const refKeys = ['quote_number', 'so_number', 'po_number', 'invoice_number', 'ticket_number', 'contract_number', 'dn_number', 'credit_note_number']
  for (const key of refKeys) {
    if (details[key]) return String(details[key])
  }
  return ''
}

function formatDetailValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.join(', ')
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'number' && (key.includes('cost') || key.includes('price') || key.includes('total') || key.includes('amount') || key.includes('variance') && !key.includes('pct'))) {
    return formatCurrency(val)
  }
  return String(val)
}

/* ── Auth Tab ── */
function AuthTab({
  data, total, page, loading, filters, users, bruteForceAlert, onFilterChange, onPageChange,
}: {
  data: unknown[]
  total: number
  page: number
  loading: boolean
  filters: AuthEventFilters
  users: OrgUser[]
  bruteForceAlert: { userName: string; failureCount: number } | null
  onFilterChange: (f: Partial<AuthEventFilters>) => void
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / (filters.pageSize || 50))

  const eventTypeGroups = [
    { label: 'All', value: '' },
    { label: 'Logins', value: 'login_success' },
    { label: 'Failures', value: '__failures__' },
    { label: 'Logouts', value: 'logout' },
    { label: 'Passkey', value: 'passkey_auth_success' },
    { label: 'MFA', value: 'mfa_success' },
    { label: 'Portal', value: 'portal_login_success' },
  ]

  return (
    <div>
      {bruteForceAlert && (
        <div className="mb-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="font-semibold">Possible brute-force:</span> {bruteForceAlert.failureCount} failed attempts for {bruteForceAlert.userName} in the last hour.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-8">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From</label>
          <input type="date" value={filters.dateFrom || ''} onChange={e => onFilterChange({ dateFrom: e.target.value })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To</label>
          <input type="date" value={filters.dateTo || ''} onChange={e => onFilterChange({ dateTo: e.target.value })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">User</label>
          <select value={filters.userId || ''} onChange={e => onFilterChange({ userId: e.target.value || undefined })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200">
            <option value="">All Users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Event Type</label>
          <select value={filters.failuresOnly ? '__failures__' : (filters.eventType || '')}
            onChange={e => {
              if (e.target.value === '__failures__') {
                onFilterChange({ eventType: undefined, failuresOnly: true })
              } else {
                onFilterChange({ eventType: e.target.value || undefined, failuresOnly: false })
              }
            }}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200">
            {eventTypeGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No authentication events found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 hidden md:table-cell">Device</th>
                <th className="px-4 py-3 hidden lg:table-cell">Network</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {data.map((row: unknown) => {
                const r = row as Record<string, unknown>
                const success = r.success as boolean
                return (
                  <tr key={r.id as string} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap" title={new Date(r.created_at as string).toLocaleString('en-GB')}>
                      {formatDate(r.created_at as string)}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-200 font-medium">{(r.user_name as string) || 'Unknown'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {formatAction(r.event_type as string)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.auth_method ? formatAction(r.auth_method as string) : '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">{(r.user_agent_class as string) || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs hidden lg:table-cell">{(r.ip_truncated as string) || '—'}</td>
                    <td className="px-4 py-3">
                      {success ? (
                        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Success</span>
                      ) : (
                        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" title={r.failure_reason as string || ''}>Failed</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">{total} results</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
            <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center px-2">Page {page} of {totalPages}</span>
            <Button size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Engagement Tab ── */
function EngagementTab({
  data, loading, dates, onDateChange,
}: {
  data: unknown[]
  loading: boolean
  dates: { from: string; to: string }
  onDateChange: (d: { from: string; to: string }) => void
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-8">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From</label>
          <input type="date" value={dates.from} onChange={e => onDateChange({ ...dates, from: e.target.value })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To</label>
          <input type="date" value={dates.to} onChange={e => onDateChange({ ...dates, to: e.target.value })}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-200" />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No engagement data found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Logins</th>
                <th className="px-4 py-3 text-right">Actions</th>
                <th className="px-4 py-3 text-right">Tickets</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Idle Periods</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Total Idle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {data.map((row: unknown) => {
                const r = row as Record<string, unknown>
                const lastPresence = r.lastPresenceAt as string | null
                const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000)
                const isOnline = lastPresence && new Date(lastPresence) > thirtyMinsAgo
                const lastActive = r.lastActiveAt as string | null
                const isToday = lastActive && new Date(lastActive).toDateString() === new Date().toDateString()
                const statusDot = isOnline ? 'bg-emerald-500' : isToday ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'
                const totalIdleMins = r.totalIdleMinutes as number

                return (
                  <tr key={r.userId as string} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 dark:text-slate-200 font-medium">{r.name as string}</span>
                        <span className="text-xs text-slate-400">{r.role as string}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDot}`} title={isOnline ? 'Online' : isToday ? 'Active today' : 'Inactive'} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{lastActive ? formatDate(lastActive) : '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-200">{r.loginCount as number}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-200">{r.actionCount as number}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-200">{r.ticketsHandled as number}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 hidden md:table-cell">{r.idlePeriodCount as number}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                      {totalIdleMins > 0 ? `${Math.floor(totalIdleMins / 60)}h ${totalIdleMins % 60}m` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
