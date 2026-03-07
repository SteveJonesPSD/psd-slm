'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { fetchLoginMethods, updateLoginMethod, getOrgPasskeyStats, clearAllOrgPasskeysAction } from './actions'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
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
  passkey: 'Passkey',
  password_passkey: 'Password + Passkey',
}

const METHOD_DESCRIPTIONS: Record<LoginMethod, string> = {
  magic_link: 'Email sign-in link — lowest friction',
  password: 'Email + password',
  password_mfa: 'Email + password + TOTP authenticator app',
  passkey: 'Email + biometric (Face ID / Touch ID / Windows Hello). No password needed.',
  password_passkey: 'Password + biometric as second factor. Strongest with modern hardware.',
}

// FUTURE: Add 'microsoft_sso' | 'microsoft_sso_mfa' options when M365 SSO phase is built

export default function LoginMethodsPage() {
  const { user } = useAuth()
  const isSuperAdmin = user.role.name === 'super_admin'

  const [settings, setSettings] = useState<Record<string, LoginMethod>>({})
  const [countsByRole, setCountsByRole] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [passkeyStats, setPasskeyStats] = useState({ totalPasskeys: 0, totalUsers: 0 })
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [data, stats] = await Promise.all([
          fetchLoginMethods(),
          isSuperAdmin ? getOrgPasskeyStats() : Promise.resolve({ totalPasskeys: 0, totalUsers: 0 }),
        ])
        setSettings(data.settings)
        setCountsByRole(data.countsByRole)
        setPasskeyStats(stats)
      } catch {
        setError('Failed to load login method settings')
      }
      setLoading(false)
    }
    load()
  }, [isSuperAdmin])

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
                    title={METHOD_DESCRIPTIONS[currentMethod]}
                  >
                    {role.key === 'super_admin' ? (
                      // Super admin cannot use magic_link or passkey-only
                      <>
                        <option value="password">{METHOD_LABELS.password}</option>
                        <option value="password_mfa">{METHOD_LABELS.password_mfa}</option>
                        <option value="password_passkey">{METHOD_LABELS.password_passkey}</option>
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

      {/* Danger Zone — Super Admin only */}
      {isSuperAdmin && passkeyStats.totalPasskeys > 0 && (
        <div className="mt-8 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-6">
          <h3 className="mb-2 text-base font-semibold text-red-700 dark:text-red-400">
            Danger Zone
          </h3>
          <p className="mb-1 text-sm text-red-600 dark:text-red-400">
            {passkeyStats.totalPasskeys} passkey{passkeyStats.totalPasskeys !== 1 ? 's' : ''} registered across {passkeyStats.totalUsers} user{passkeyStats.totalUsers !== 1 ? 's' : ''}
          </p>
          <p className="mb-4 text-xs text-red-500 dark:text-red-500/80">
            Remove all passkeys for all users. Everyone will need to re-register. Use before a domain migration or if the RP ID has changed.
          </p>
          <Button
            size="sm"
            variant="danger"
            onClick={() => { setShowResetModal(true); setResetConfirmText('') }}
          >
            Reset All Passkeys
          </Button>

          {showResetModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
                <h3 className="mb-3 text-lg font-semibold text-red-700 dark:text-red-400">
                  Reset All Passkeys
                </h3>
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                  This will remove <strong>{passkeyStats.totalPasskeys}</strong> passkey{passkeyStats.totalPasskeys !== 1 ? 's' : ''} across <strong>{passkeyStats.totalUsers}</strong> user{passkeyStats.totalUsers !== 1 ? 's' : ''}. This action cannot be undone.
                </p>
                <div className="mb-5">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Type <span className="font-mono font-bold">RESET</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-mono focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="RESET"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setShowResetModal(false)}>Cancel</Button>
                  <Button
                    variant="danger"
                    disabled={resetConfirmText !== 'RESET' || resetLoading}
                    onClick={async () => {
                      setResetLoading(true)
                      const result = await clearAllOrgPasskeysAction()
                      setResetLoading(false)
                      setShowResetModal(false)
                      if (result.error) {
                        setError(result.error)
                      } else {
                        setPasskeyStats({ totalPasskeys: 0, totalUsers: 0 })
                        setSuccessMsg(`All passkeys cleared (${result.count} removed). Users will need to re-register.`)
                      }
                    }}
                  >
                    {resetLoading ? 'Resetting...' : 'Reset All Passkeys'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {successMsg && (
        <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {successMsg}
        </div>
      )}
    </div>
  )
}
