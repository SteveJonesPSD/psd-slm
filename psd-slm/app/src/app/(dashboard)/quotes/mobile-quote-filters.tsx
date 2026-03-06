'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { QUOTE_STATUS_CONFIG, QUOTE_TYPE_CONFIG } from '@/components/ui/badge'

interface MobileQuoteFiltersProps {
  open: boolean
  onClose: () => void
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  typeFilter: string
  setTypeFilter: (v: string) => void
  ownerFilter: 'all' | 'mine'
  setOwnerFilter: (v: 'all' | 'mine') => void
  showRevised: boolean
  setShowRevised: (v: boolean) => void
  onApply: () => void
  onClear: () => void
}

export function MobileQuoteFilters({
  open,
  onClose,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  ownerFilter,
  setOwnerFilter,
  showRevised,
  setShowRevised,
  onApply,
  onClear,
}: MobileQuoteFiltersProps) {
  function handleApply() {
    onApply()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Filters">
      <div className="space-y-5">
        {/* Search */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Search</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleApply() }}
            placeholder="Search quotes..."
            className="w-full rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Owner pills */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Owner</label>
          <div className="flex gap-2">
            {(['all', 'mine'] as const).map(v => (
              <button
                key={v}
                onClick={() => setOwnerFilter(v)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                  ownerFilter === v
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}
              >
                {v === 'all' ? 'All Quotes' : 'My Quotes'}
              </button>
            ))}
          </div>
        </div>

        {/* Status pills */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('')}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                !statusFilter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
              }`}
            >
              All
            </button>
            {Object.entries(QUOTE_STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                  statusFilter === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type pills */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Type</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('')}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                !typeFilter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
              }`}
            >
              All
            </button>
            {Object.entries(QUOTE_TYPE_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                  typeFilter === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Show revised toggle */}
        <div>
          <label className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRevised}
              onChange={(e) => setShowRevised(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 h-5 w-5"
            />
            Show revised quotes
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onClear}
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white active:bg-indigo-700"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
