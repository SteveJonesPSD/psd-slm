'use client'

import { useState, useEffect, useCallback } from 'react'
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
  fetchPasskeys,
  removePasskey,
  renamePasskeyAction,
} from './actions'

interface TrustedDevice {
  id: string
  device_name: string | null
  last_used_at: string
  created_at: string
  expires_at: string
}

interface PasskeyInfo {
  id: string
  device_name: string
  last_used_at: string | null
  created_at: string
}

export default function SecurityPage() {
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

  // Passkey state
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [registeringPasskey, setRegisteringPasskey] = useState(false)
  const [renamingPasskey, setRenamingPasskey] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showRemovePasskeyConfirm, setShowRemovePasskeyConfirm] = useState<string | null>(null)

  const [showRemoveMfaConfirm, setShowRemoveMfaConfirm] = useState(false)
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false)

  const loadPasskeys = useCallback(async () => {
    const pks = await fetchPasskeys()
    setPasskeys(pks)
  }, [])

  useEffect(() => {
    async function load() {
      const [mfa, devs, pks] = await Promise.all([getMfaStatus(), fetchTrustedDevices(), fetchPasskeys()])
      setMfaEnrolled(mfa.enrolled)
      setFactorId(mfa.factorId)
      setMfaRequired(mfa.mfaRequired)
      setDevices(devs)
      setPasskeys(pks)
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

  async function handleRegisterPasskey() {
    setRegisteringPasskey(true)
    setMessage(null)

    try {
      const { startRegistration } = await import('@simplewebauthn/browser')

      const optionsRes = await fetch('/api/passkeys/register/options', { method: 'POST' })
      if (!optionsRes.ok) {
        const data = await optionsRes.json()
        setMessage({ type: 'error', text: data.error || 'Failed to start registration' })
        setRegisteringPasskey(false)
        return
      }

      const { options, challengeId, suggestedName } = await optionsRes.json()

      const regResponse = await startRegistration({ optionsJSON: options })

      const verifyRes = await fetch('/api/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          response: regResponse,
          deviceName: suggestedName,
        }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setMessage({ type: 'error', text: data.error || 'Registration failed' })
        setRegisteringPasskey(false)
        return
      }

      setMessage({ type: 'success', text: `Passkey registered! You can now sign in with ${suggestedName}.` })
      await loadPasskeys()
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError') {
        setMessage({ type: 'error', text: 'Registration cancelled — you can try again anytime.' })
      } else if (error.name === 'SecurityError') {
        setMessage({ type: 'error', text: 'Passkeys require a secure connection.' })
      } else {
        setMessage({ type: 'error', text: error.message || 'Passkey registration failed' })
      }
    } finally {
      setRegisteringPasskey(false)
    }
  }

  async function handleRemovePasskey(passkeyId: string) {
    setActionLoading(true)
    const result = await removePasskey(passkeyId)
    setActionLoading(false)
    setShowRemovePasskeyConfirm(null)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setPasskeys(prev => prev.filter(p => p.id !== passkeyId))
      setMessage({ type: 'success', text: 'Passkey removed' })
    }
  }

  async function handleRenamePasskey(passkeyId: string) {
    if (!renameValue.trim()) return
    setActionLoading(true)
    const result = await renamePasskeyAction(passkeyId, renameValue.trim())
    setActionLoading(false)
    setRenamingPasskey(null)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setPasskeys(prev => prev.map(p => p.id === passkeyId ? { ...p, device_name: renameValue.trim() } : p))
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
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
              <Button size="sm" variant="primary" onClick={() => router.push('/auth/mfa-setup?from=settings')}>
                Set up authenticator app
              </Button>
            )}
          </div>
        </div>

        {/* Passkeys */}
        <div id="passkeys" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Passkeys
            </h3>
            <Button
              size="sm"
              variant="primary"
              onClick={handleRegisterPasskey}
              disabled={registeringPasskey}
            >
              {registeringPasskey ? 'Registering...' : passkeys.length > 0 ? 'Add Another Passkey' : 'Add Passkey'}
            </Button>
          </div>

          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Use Face ID, Touch ID, or Windows Hello to sign in faster. Register on each device you use.
          </p>

          {passkeys.length === 0 ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">No passkeys registered</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center justify-between py-3">
                  <div>
                    {renamingPasskey === pk.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenamePasskey(pk.id)}
                          className="rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                        <Button size="sm" variant="primary" onClick={() => handleRenamePasskey(pk.id)} disabled={actionLoading}>
                          Save
                        </Button>
                        <Button size="sm" variant="default" onClick={() => setRenamingPasskey(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {pk.device_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          Registered {new Date(pk.created_at).toLocaleDateString('en-GB')}
                          {pk.last_used_at && ` · Last used ${new Date(pk.last_used_at).toLocaleDateString('en-GB')}`}
                        </p>
                      </>
                    )}
                  </div>
                  {renamingPasskey !== pk.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setRenamingPasskey(pk.id); setRenameValue(pk.device_name) }}
                      >
                        Rename
                      </Button>
                      {showRemovePasskeyConfirm === pk.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Sure?</span>
                          <Button size="sm" variant="danger" onClick={() => handleRemovePasskey(pk.id)} disabled={actionLoading}>
                            Remove
                          </Button>
                          <Button size="sm" variant="default" onClick={() => setShowRemovePasskeyConfirm(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setShowRemovePasskeyConfirm(pk.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
