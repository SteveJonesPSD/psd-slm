'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { QUOTE_STATUS_CONFIG } from '@/components/ui/badge'
import { saveMyViewPreferences } from './actions'

interface DefaultViewsFormProps {
  initialPreferences: Record<string, string>
}

export function DefaultViewsForm({ initialPreferences }: DefaultViewsFormProps) {
  const [prefs, setPrefs] = useState(initialPreferences)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = (key: string, value: string) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await saveMyViewPreferences(prefs)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mb-1">Default Views</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Choose which filters are applied by default when you open these pages.
      </p>

      {/* Quotes defaults */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Quotes</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Owner</label>
            <select
              value={prefs.quotes_owner || 'all'}
              onChange={(e) => update('quotes_owner', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-slate-400"
            >
              <option value="all">All Quotes</option>
              <option value="mine">My Quotes</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
            <select
              value={prefs.quotes_status || ''}
              onChange={(e) => update('quotes_status', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-slate-400"
            >
              <option value="">All Statuses</option>
              {Object.entries(QUOTE_STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pipeline defaults */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Pipeline</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Owner</label>
            <select
              value={prefs.pipeline_owner || ''}
              onChange={(e) => update('pipeline_owner', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-slate-400"
            >
              <option value="">All Opportunities</option>
              <option value="mine">My Opportunities</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">View</label>
            <select
              value={prefs.pipeline_view || 'kanban'}
              onChange={(e) => update('pipeline_view', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-slate-400"
            >
              <option value="kanban">Kanban Board</option>
              <option value="list">List View</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Defaults'}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  )
}
