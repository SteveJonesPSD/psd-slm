'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG } from '@/components/ui/badge'
import { SearchPreviewPanel } from './search-preview-panel'

interface SelectedItem {
  type: string
  id: string
  href: string
}

interface SearchResult {
  type: string
  id: string
  label: string
  sub: string | null
  status: string | null
  href: string
}

const TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  Contact:      { color: '#059669', bg: '#ecfdf5' },
  Quote:        { color: '#d97706', bg: '#fffbeb' },
  Opportunity:  { color: '#6366f1', bg: '#eef2ff' },
  'Sales Order': { color: '#2563eb', bg: '#eff6ff' },
  Ticket:       { color: '#dc2626', bg: '#fef2f2' },
  Invoice:      { color: '#059669', bg: '#ecfdf5' },
  Job:          { color: '#7c3aed', bg: '#f5f3ff' },
  'Purchase Order': { color: '#0891b2', bg: '#ecfeff' },
  Contract:     { color: '#0d9488', bg: '#f0fdfa' },
  'Deal Reg':   { color: '#ea580c', bg: '#fff7ed' },
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  // Quote statuses
  draft: { color: '#64748b', bg: '#f1f5f9' },
  sent: { color: '#2563eb', bg: '#eff6ff' },
  accepted: { color: '#059669', bg: '#ecfdf5' },
  declined: { color: '#dc2626', bg: '#fef2f2' },
  // SO statuses
  pending: { color: '#d97706', bg: '#fffbeb' },
  confirmed: { color: '#2563eb', bg: '#eff6ff' },
  in_progress: { color: '#6366f1', bg: '#eef2ff' },
  fulfilled: { color: '#059669', bg: '#ecfdf5' },
  cancelled: { color: '#64748b', bg: '#f1f5f9' },
  // Ticket statuses
  new: { color: '#6366f1', bg: '#eef2ff' },
  open: { color: '#2563eb', bg: '#eff6ff' },
  resolved: { color: '#059669', bg: '#ecfdf5' },
  closed: { color: '#64748b', bg: '#f1f5f9' },
  // Invoice statuses
  paid: { color: '#059669', bg: '#ecfdf5' },
  overdue: { color: '#dc2626', bg: '#fef2f2' },
  void: { color: '#64748b', bg: '#f1f5f9' },
  // Opportunity stages
  prospecting: { color: '#6366f1', bg: '#eef2ff' },
  qualifying: { color: '#2563eb', bg: '#eff6ff' },
  proposal: { color: '#d97706', bg: '#fffbeb' },
  negotiation: { color: '#ea580c', bg: '#fff7ed' },
  won: { color: '#059669', bg: '#ecfdf5' },
  lost: { color: '#dc2626', bg: '#fef2f2' },
  // Deal reg
  active: { color: '#059669', bg: '#ecfdf5' },
  expired: { color: '#64748b', bg: '#f1f5f9' },
  rejected: { color: '#dc2626', bg: '#fef2f2' },
  // Job statuses
  scheduled: { color: '#2563eb', bg: '#eff6ff' },
  completed: { color: '#059669', bg: '#ecfdf5' },
  // Generic fallbacks
  partially_fulfilled: { color: '#d97706', bg: '#fffbeb' },
  partially_received: { color: '#d97706', bg: '#fffbeb' },
  received: { color: '#059669', bg: '#ecfdf5' },
  acknowledged: { color: '#2563eb', bg: '#eff6ff' },
  waiting_on_customer: { color: '#d97706', bg: '#fffbeb' },
  credit_note: { color: '#7c3aed', bg: '#f5f3ff' },
}

export function CustomerSearch({ customerId }: { customerId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      setSelected(null)
      return
    }
    setLoading(true)
    setSelected(null)
    try {
      const res = await fetch(`/api/customers/${customerId}/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
        setOpen(true)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [customerId])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 250)
  }

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSelected(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selected) {
          setSelected(null)
        } else {
          setOpen(false)
          inputRef.current?.blur()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [selected])

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search quotes, orders, tickets, jobs..."
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-500 transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl">
          {Object.entries(grouped).map(([type, items]) => {
            const style = TYPE_STYLES[type] || { color: '#64748b', bg: '#f1f5f9' }
            return (
              <div key={type}>
                <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  {type}s
                </div>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelected({ type: item.type, id: item.id, href: item.href })}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors border-b border-slate-50 dark:border-slate-700/30 last:border-b-0 ${
                      selected?.id === item.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                    }`}
                  >
                    <Badge label={type} color={style.color} bg={style.bg} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.label}
                      </div>
                      {item.sub && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {item.sub}
                        </div>
                      )}
                    </div>
                    {item.status && (() => {
                      const sc = STATUS_COLORS[item.status]
                      const ticketCfg = TICKET_STATUS_CONFIG[item.status]
                      const label = ticketCfg?.label || item.status.replace(/_/g, ' ')
                      const color = sc?.color || '#64748b'
                      const bg = sc?.bg || '#f1f5f9'
                      return <Badge label={label} color={color} bg={bg} />
                    })()}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}

      {selected && (
        <SearchPreviewPanel
          customerId={customerId}
          type={selected.type}
          entityId={selected.id}
          href={selected.href}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
