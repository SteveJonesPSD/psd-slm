'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { fetchLoginMethods, updateLoginMethod } from './actions'
import type { LoginMethod } from '@/lib/login-methods'

const ROLES = [
  { key: 'super_admin', label: 'Super Admin' },
  { key: 'admin', label: 'Admin' },
  { key: 'sales', label: 'Sales' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'purchasing', label: 'Purchasing' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'field_engineer', label: 'Field Engineer' },
]

const METHOD_LABELS: Record<LoginMethod, string> = {
  magic_link: 'Magic Link',
  password: 'Password',
  password_mfa: 'Password + MFA',
}

// FUTURE: Add 'microsoft_sso' | 'microsoft_sso_mfa' options when M365 SSO phase is built

export default function LoginMethodsPage() {
  const [settings, setSettings] = useState<Record<string, LoginMethod>>({})
  const [countsByRole, setCountsByRole] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchLoginMethods()
        setSettings(data.settings)
        setCountsByRole(data.countsByRole)
      } catch {
        setError('Failed to load login method settings')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleChange(role: string, method: LoginMethod) {
    setError(null)
    setSaving(role)

    const result = await updateLoginMethod(role, method)
    setSaving(null)

    if (result.error) {
      setError(result.error)
      return
    }

    setSettings(prev => ({ ...prev, [role]: method }))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Login Methods"
        subtitle="Control how each role signs into Engage. Changes take effect on the next sign-in."
      />

      {/* FUTURE: Add Microsoft SSO provider configuration section */}

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Role</span>
            <span className="w-24 text-center">Users</span>
            <span className="w-52">Login Method</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {ROLES.map((role) => {
            const currentMethod = settings[role.key] ?? 'password'
            const userCount = countsByRole[role.key] ?? 0

            return (
              <div
                key={role.key}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {role.label}
                </span>
                <span className="w-24 text-center text-sm text-slate-500 dark:text-slate-400">
                  {userCount} {userCount === 1 ? 'user' : 'users'}
                </span>
                <div className="w-52">
                  <select
                    value={currentMethod}
                    onChange={(e) => handleChange(role.key, e.target.value as LoginMethod)}
                    disabled={saving === role.key}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {role.key === 'super_admin' ? (
                      // Super admin cannot use magic_link
                      <>
                        <option value="password">{METHOD_LABELS.password}</option>
                        <option value="password_mfa">{METHOD_LABELS.password_mfa}</option>
                      </>
                    ) : (
                      Object.entries(METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
