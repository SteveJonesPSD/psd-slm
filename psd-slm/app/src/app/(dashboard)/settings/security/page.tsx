'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import {
  getMfaStatus,
  removeMfa,
  fetchTrustedDevices,
  revokeDevice,
  revokeAllDevices,
  updatePassword,
  setNewPassword,
} from './actions'

interface TrustedDevice {
  id: string
  device_name: string | null
  last_used_at: string
  created_at: string
  expires_at: string
}

export default function SecuritySettingsPage() {
  const router = useRouter()
  const [mfaEnrolled, setMfaEnrolled] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [devices, setDevices] = useState<TrustedDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPasswordVal, setNewPasswordVal] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showRemoveMfaConfirm, setShowRemoveMfaConfirm] = useState(false)
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false)

  useEffect(() => {
    async function load() {
      const [mfa, devs] = await Promise.all([getMfaStatus(), fetchTrustedDevices()])
      setMfaEnrolled(mfa.enrolled)
      setFactorId(mfa.factorId)
      setMfaRequired(mfa.mfaRequired)
      setDevices(devs)
      setLoading(false)
    }
    load()
  }, [])

  async function handleRemoveMfa() {
    if (!factorId) return
    setActionLoading(true)
    const result = await removeMfa(factorId)
    setActionLoading(false)
    setShowRemoveMfaConfirm(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMfaEnrolled(false)
      setFactorId(null)
      setMessage({ type: 'success', text: 'Two-factor authentication removed' })
    }
  }

  async function handleRevokeDevice(deviceId: string) {
    setActionLoading(true)
    await revokeDevice(deviceId)
    setDevices(prev => prev.filter(d => d.id !== deviceId))
    setActionLoading(false)
  }

  async function handleRevokeAll() {
    setActionLoading(true)
    await revokeAllDevices()
    setDevices([])
    setActionLoading(false)
    setShowRevokeAllConfirm(false)
    setMessage({ type: 'success', text: 'All trusted devices revoked' })
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (newPasswordVal !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    setActionLoading(true)
    const result = currentPassword
      ? await updatePassword(currentPassword, newPasswordVal)
      : await setNewPassword(newPasswordVal)
    setActionLoading(false)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully' })
      setCurrentPassword('')
      setNewPasswordVal('')
      setConfirmPassword('')
    }
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
      <PageHeader title="Security" subtitle="Manage your authentication and trusted devices" />

      {message && (
        <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* MFA Status */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Two-Factor Authentication
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mfaEnrolled ? (
                <>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Active
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">TOTP authenticator app</span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Not configured
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">No authenticator app linked</span>
                </>
              )}
            </div>
            {mfaEnrolled ? (
              mfaRequired ? (
                <span className="text-xs text-slate-400" title="Your role requires MFA — it cannot be removed">
                  Required by role
                </span>
              ) : showRemoveMfaConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Are you sure?</span>
                  <Button size="sm" variant="danger" onClick={handleRemoveMfa} disabled={actionLoading}>
                    Remove
                  </Button>
                  <Button size="sm" variant="default" onClick={() => setShowRemoveMfaConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setShowRemoveMfaConfirm(true)}>
                  Remove
                </Button>
              )
            ) : (
              // FUTURE: Add Passkeys section to security settings
              <Button size="sm" variant="primary" onClick={() => router.push('/auth/mfa-setup?from=settings')}>
                Set up authenticator app
              </Button>
            )}
          </div>
        </div>

        {/* Trusted Devices */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Trusted Devices
            </h3>
            {devices.length > 0 && (
              showRevokeAllConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Revoke all?</span>
                  <Button size="sm" variant="danger" onClick={handleRevokeAll} disabled={actionLoading}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="default" onClick={() => setShowRevokeAllConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="danger" onClick={() => setShowRevokeAllConfirm(true)}>
                  Revoke all
                </Button>
              )
            )}
          </div>

          {devices.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No trusted devices. You&apos;ll be asked to verify your identity each time you sign in.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {device.device_name || 'Unknown device'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Last used {new Date(device.last_used_at).toLocaleDateString('en-GB')} &middot;
                      Expires {new Date(device.expires_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleRevokeDevice(device.id)}
                    disabled={actionLoading}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Password */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Password
          </h3>
          <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Current Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Re-enter new password"
              />
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={actionLoading || !newPasswordVal}>
              {actionLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
