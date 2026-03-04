'use client'

import { useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { saveThemePreference } from './actions'

const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Light', icon: '☀️' },
  { value: 'dark' as const, label: 'Dark', icon: '🌙' },
  { value: 'system' as const, label: 'Auto', icon: '💻' },
]

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [saving, setSaving] = useState(false)

  const handleChange = async (value: 'light' | 'dark' | 'system') => {
    setTheme(value)
    setSaving(true)
    await saveThemePreference(value)
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Appearance</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Choose your preferred theme{saving ? ' — saving...' : ''}
      </p>
      <div className="flex gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleChange(opt.value)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              theme === opt.value
                ? 'bg-slate-900 text-white dark:bg-slate-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            <span>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
