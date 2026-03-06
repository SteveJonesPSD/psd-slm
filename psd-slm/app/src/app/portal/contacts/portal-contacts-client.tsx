'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePortal } from '../portal-context'
import type { PortalContactItem } from '@/lib/portal/types'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-amber-100 text-amber-700',
  none: 'bg-slate-100 text-slate-500',
}

export function PortalContactsClient({ contacts, isAdmin }: { contacts: PortalContactItem[]; isAdmin: boolean }) {
  const ctx = usePortal()
  const router = useRouter()
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '' })
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const portalUsers = contacts.filter((c) => c.portalStatus !== 'none')
  const nonPortal = contacts.filter((c) => c.portalStatus === 'none')

  async function handleInvite(contactId: string) {
    setLoading(contactId)
    setError(null)
    try {
      const { inviteContactToPortal } = await import('@/lib/portal/contacts-actions')
      const result = await inviteContactToPortal(contactId, false, ctx)
      if (result.error) setError(result.error)
      else router.refresh()
    } catch {
      setError('Failed to invite')
    } finally {
      setLoading(null)
    }
  }

  async function handleRevoke(portalUserId: string) {
    if (!confirm('Remove portal access for this contact?')) return
    setLoading(portalUserId)
    setError(null)
    try {
      const { revokePortalAccess } = await import('@/lib/portal/contacts-actions')
      const result = await revokePortalAccess(portalUserId, ctx)
      if (result.error) setError(result.error)
      else router.refresh()
    } catch {
      setError('Failed to revoke')
    } finally {
      setLoading(null)
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.email.trim()) return
    setLoading('add')
    setError(null)
    try {
      const { addPortalContact } = await import('@/lib/portal/contacts-actions')
      const result = await addPortalContact({
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim() || undefined,
        jobTitle: addForm.jobTitle.trim() || undefined,
      }, ctx)
      if (result.error) setError(result.error)
      else {
        setShowAddForm(false)
        setAddForm({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '' })
        router.refresh()
      }
    } catch {
      setError('Failed to add contact')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Portal Users */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-8">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Portal Users</h2>
        </div>
        {portalUsers.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No portal users yet</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {portalUsers.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{c.firstName} {c.lastName}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[c.portalStatus]}`}>
                      {c.portalStatus}
                    </span>
                    {c.isPortalAdmin && (
                      <span className="inline-block rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[11px] font-medium">Admin</span>
                    )}
                  </div>
                  {c.jobTitle && <p className="text-xs text-slate-400">{c.jobTitle}</p>}
                  {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                </div>
                {isAdmin && c.portalUserId && c.portalUserId !== ctx.portalUserId && (
                  <button
                    onClick={() => handleRevoke(c.portalUserId!)}
                    disabled={loading === c.portalUserId}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Contacts (admin only) */}
      {isAdmin && nonPortal.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-8">
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Other Contacts</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {nonPortal.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-sm font-medium text-slate-900">{c.firstName} {c.lastName}</span>
                  {c.jobTitle && <span className="ml-2 text-xs text-slate-400">{c.jobTitle}</span>}
                  {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                </div>
                <button
                  onClick={() => handleInvite(c.id)}
                  disabled={loading === c.id || !c.email}
                  className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  {loading === c.id ? 'Inviting...' : 'Invite to Portal'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Contact (admin only) */}
      {isAdmin && (
        <div>
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Contact
            </button>
          ) : (
            <form onSubmit={handleAddContact} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Add New Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                  <input type="text" required value={addForm.firstName} onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
                  <input type="text" required value={addForm.lastName} onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                  <input type="email" required value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input type="text" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Job Title</label>
                  <input type="text" value={addForm.jobTitle} onChange={(e) => setAddForm((f) => ({ ...f, jobTitle: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={loading === 'add'} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {loading === 'add' ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
