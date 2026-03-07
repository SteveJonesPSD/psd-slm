'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PortalUser {
  id: string
  contactId: string
  contactName: string
  contactEmail: string | null
  isPortalAdmin: boolean
  isActive: boolean
  lastLoginAt: string | null
  invitedAt: string | null
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

export function PortalAccessSection({ customerId, contacts, canEdit }: {
  customerId: string
  contacts: Contact[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showGrant, setShowGrant] = useState(false)
  const [selectedContact, setSelectedContact] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPortalUsers = useCallback(async () => {
    try {
      const { getPortalUsersForCustomer } = await import('@/lib/portal/admin-actions')
      const data = await getPortalUsersForCustomer(customerId)
      setPortalUsers(data)
    } catch {
      // Module may not be deployed
    } finally {
      setLoaded(true)
    }
  }, [customerId])

  useEffect(() => {
    loadPortalUsers()
  }, [loadPortalUsers])

  const contactsWithoutAccess = contacts.filter(
    (c) => c.email && !portalUsers.some((pu) => pu.contactId === c.id)
  )

  async function handleGrant() {
    if (!selectedContact) return
    setLoading('grant')
    setError(null)
    try {
      const { grantPortalAccess } = await import('@/lib/portal/admin-actions')
      const result = await grantPortalAccess(selectedContact, customerId, isAdmin)
      if (result.error) {
        setError(result.error)
      } else {
        setShowGrant(false)
        setSelectedContact('')
        setIsAdmin(false)
        await loadPortalUsers()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant access')
    } finally {
      setLoading(null)
    }
  }

  async function handleRevoke(portalUserId: string) {
    if (!confirm('Revoke portal access for this user?')) return
    setLoading(portalUserId)
    setError(null)
    try {
      const { revokePortalAccessInternal } = await import('@/lib/portal/admin-actions')
      const result = await revokePortalAccessInternal(portalUserId, customerId)
      if (result.error) setError(result.error)
      else await loadPortalUsers()
    } catch {
      setError('Failed to revoke')
    } finally {
      setLoading(null)
    }
  }

  async function handleResend(portalUserId: string) {
    setLoading(portalUserId)
    setError(null)
    try {
      const { resendPortalInvite } = await import('@/lib/portal/admin-actions')
      const result = await resendPortalInvite(portalUserId, customerId)
      if (result.error) setError(result.error)
      else {
        setError(null)
        await loadPortalUsers()
      }
    } catch {
      setError('Failed to resend')
    } finally {
      setLoading(null)
    }
  }

  async function handleImpersonate(pu: PortalUser) {
    setLoading(`imp-${pu.id}`)
    setError(null)
    try {
      const res = await fetch('/api/portal/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, contactId: pu.contactId }),
      })
      const data = await res.json()
      if (!res.ok || !data.token) {
        setError(data.error || 'Failed to impersonate')
        return
      }
      window.open(`/api/portal/impersonate/start?token=${data.token}`, '_blank')
    } catch {
      setError('Failed to impersonate')
    } finally {
      setLoading(null)
    }
  }

  if (!loaded) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 mb-8">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Portal Access</h3>
          <span className="rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[11px] font-medium">
            {portalUsers.filter((u) => u.isActive).length} active
          </span>
        </div>
        {canEdit && contactsWithoutAccess.length > 0 && (
          <Button size="sm" variant="primary" onClick={() => setShowGrant(true)}>
            Grant Access
          </Button>
        )}
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">{error}</div>
      )}

      {/* Grant access form */}
      {showGrant && (
        <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Contact</label>
              <select
                value={selectedContact}
                onChange={(e) => setSelectedContact(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
              >
                <option value="">Select a contact...</option>
                {contactsWithoutAccess.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="rounded" />
              Portal Admin
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={handleGrant} disabled={!selectedContact || loading === 'grant'}>
                {loading === 'grant' ? 'Granting...' : 'Invite'}
              </Button>
              <Button size="sm" onClick={() => { setShowGrant(false); setError(null) }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Portal users table */}
      {portalUsers.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No portal users for this customer
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {portalUsers.map((pu) => (
            <div key={pu.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{pu.contactName}</span>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    pu.isActive
                      ? pu.lastLoginAt ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {pu.isActive ? (pu.lastLoginAt ? 'Active' : 'Invited') : 'Inactive'}
                  </span>
                  {pu.isPortalAdmin && (
                    <span className="inline-block rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 text-[11px] font-medium">
                      Admin
                    </span>
                  )}
                  {(pu as PortalUser & { isGroupAdmin?: boolean }).isGroupAdmin && (
                    <span className="inline-block rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 text-[11px] font-medium">
                      Group Admin
                    </span>
                  )}
                </div>
                {pu.contactEmail && <p className="text-xs text-slate-400">{pu.contactEmail}</p>}
                {pu.lastLoginAt && <p className="text-xs text-slate-400">Last login: {formatRelativeTime(pu.lastLoginAt)}</p>}
              </div>
              {pu.isActive && (
                <div className="flex gap-2">
                  <Button size="sm" variant="purple" onClick={() => handleImpersonate(pu)} disabled={loading === `imp-${pu.id}`}>
                    {loading === `imp-${pu.id}` ? 'Opening...' : 'Impersonate'}
                  </Button>
                  {canEdit && !pu.lastLoginAt && (
                    <Button size="sm" variant="blue" onClick={() => handleResend(pu.id)} disabled={loading === pu.id}>
                      Resend
                    </Button>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="danger" onClick={() => handleRevoke(pu.id)} disabled={loading === pu.id}>
                      Revoke
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
