'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'

interface MobileQueueFiltersProps {
  open: boolean
  onClose: () => void
  search: string
  setSearch: (v: string) => void
  priorityFilter: string
  setPriorityFilter: (v: string) => void
  assignedFilter: string
  setAssignedFilter: (v: string) => void
  typeFilter: string
  setTypeFilter: (v: string) => void
  showAll: boolean
  setShowAll: (v: boolean) => void
  teamMembers: { id: string; first_name: string; last_name: string }[]
  onApply: () => void
  onClear: () => void
}

const PRIORITIES = [
  { value: '', label: 'All' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const TYPES = [
  { value: '', label: 'All' },
  { value: 'helpdesk', label: 'Service Desk' },
  { value: 'onsite_job', label: 'Onsite' },
]

export function MobileQueueFilters({
  open,
  onClose,
  search,
  setSearch,
  priorityFilter,
  setPriorityFilter,
  assignedFilter,
  setAssignedFilter,
  typeFilter,
  setTypeFilter,
  showAll,
  setShowAll,
  teamMembers,
  onApply,
  onClear,
}: MobileQueueFiltersProps) {
  function handleApply() {
    onApply()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Filters">
      <div className="space-y-5">
        {/* Search */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Search</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Priority pills */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Priority</label>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                onClick={() => setPriorityFilter(p.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  priorityFilter === p.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Assigned To */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Assigned To</label>
          <select
            value={assignedFilter}
            onChange={e => setAssignedFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Agents</option>
            {teamMembers.map(m => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        </div>

        {/* Type pills */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === t.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status toggle */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Status</label>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAll(false)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !showAll ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                showAll ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onClear}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
