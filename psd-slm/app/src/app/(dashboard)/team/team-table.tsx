'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Avatar } from '@/components/ui/avatar'
import { Badge, ROLE_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Checkbox } from '@/components/ui/form-fields'
import { useAuth } from '@/components/auth-provider'
import { inviteUser, updateUser, deactivateUser, reactivateUser, resetPassword, clearUserPasskeysAction, bulkInviteUsers, type BulkInviteResult } from './actions'
import { disconnectMailCredential } from '@/app/(dashboard)/quotes/send-actions'
import type { User, Role } from '@/types/database'
import type { UserMailCredential } from '@/lib/email/types'

type UserWithRole = User & { roles: { id: string; name: string; display_name: string } }

interface TeamTableProps {
  users: UserWithRole[]
  roles: Pick<Role, 'id' | 'name' | 'display_name'>[]
  mailCredentials?: UserMailCredential[]
  passkeyCounts?: Record<string, number>
}

const PRESET_COLOURS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#1e293b',
]

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  role_id: '',
  color: '#6366f1',
  initials: '',
  avatar_url: '' as string | null,
}

export function TeamTable({ users, roles, mailCredentials = [], passkeyCounts = {} }: TeamTableProps) {
  const router = useRouter()
  const { user: currentUser, hasPermission } = useAuth()

  const canCreate = hasPermission('team', 'create')
  const canEdit = hasPermission('team', 'edit_all')
  const canDelete = hasPermission('team', 'delete')
  const showActions = canEdit || canDelete

  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserWithRole | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; error?: string } | null>(null)
  const [sendEmail, setSendEmail] = useState(true)
  const [resetTarget, setResetTarget] = useState<UserWithRole | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [connectingMailFor, setConnectingMailFor] = useState<string | null>(null)
  const [clearPasskeyTarget, setClearPasskeyTarget] = useState<UserWithRole | null>(null)
  const [clearingPasskeys, setClearingPasskeys] = useState(false)
  const [localPasskeyCounts, setLocalPasskeyCounts] = useState(passkeyCounts)

  // Bulk invite state
  const [showBulkInvite, setShowBulkInvite] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkRoleId, setBulkRoleId] = useState('')
  const [bulkSendEmails, setBulkSendEmails] = useState(true)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkResults, setBulkResults] = useState<BulkInviteResult[] | null>(null)

  const getMailCred = (userId: string) => mailCredentials.find(c => c.user_id === userId)

  const handleConnectMailbox = async (userId: string) => {
    setConnectingMailFor(userId)
    try {
      const res = await fetch(`/api/auth/mail-connect?user_id=${userId}`)
      const data = await res.json()
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl
      } else {
        alert(data.error || 'Failed to initiate mailbox connection')
      }
    } catch {
      alert('Failed to connect mailbox')
    } finally {
      setConnectingMailFor(null)
    }
  }

  const handleDisconnectMailbox = async (userId: string) => {
    const cred = getMailCred(userId)
    if (!cred) return
    if (!confirm(`Disconnect ${cred.email_address}? This user won't be able to send quotes via email.`)) return
    const result = await disconnectMailCredential(userId)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const filtered = users.filter((u) => {
    if (!showInactive && !u.is_active) return false
    const term = search.toLowerCase()
    if (!term) return true
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    )
  })

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const openInvite = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setTempPassword(null)
    setEmailStatus(null)
    setSendEmail(true)
    setShowForm(true)
  }

  const openEdit = (u: UserWithRole) => {
    setEditing(u)
    setForm({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      role_id: u.role_id,
      color: u.color || '#6366f1',
      initials: u.initials || '',
      avatar_url: u.avatar_url || null,
    })
    setError('')
    setTempPassword(null)
    setEmailStatus(null)
    setShowForm(true)
  }

  const handleAvatarUpload = async (file: File) => {
    if (!editing) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Invalid file type. Use PNG, JPG, or WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('File too large. Maximum 2MB.')
      return
    }
    setAvatarUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'user')
      fd.append('targetId', editing.id)
      if (form.avatar_url) fd.append('oldPath', form.avatar_url)
      const res = await fetch('/api/avatars/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Upload failed'); return }
      setForm((f) => ({ ...f, avatar_url: data.url }))
    } catch {
      setError('Upload failed.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleAvatarRemove = async () => {
    if (!editing || !form.avatar_url) return
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('type', 'user')
      fd.append('targetId', editing.id)
      fd.append('delete', '1')
      fd.append('oldPath', form.avatar_url)
      await fetch('/api/avatars/upload', { method: 'POST', body: fd })
      setForm((f) => ({ ...f, avatar_url: null }))
    } catch {
      setError('Failed to remove avatar.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    const fd = new FormData()
    fd.append('first_name', form.first_name)
    fd.append('last_name', form.last_name)
    fd.append('email', form.email)
    fd.append('role_id', form.role_id)
    fd.append('color', form.color)
    fd.append('initials', form.initials || (form.first_name[0] + form.last_name[0]).toUpperCase())
    if (form.avatar_url) {
      fd.append('avatar_url', form.avatar_url)
    }
    if (!sendEmail) {
      fd.append('send_email', 'false')
    }

    if (editing) {
      const result = await updateUser(editing.id, fd)
      setSaving(false)
      if (result.error) {
        setError(result.error)
      } else {
        setShowForm(false)
        setEditing(null)
        router.refresh()
      }
    } else {
      const result = await inviteUser(fd)
      setSaving(false)
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setTempPassword(result.data.tempPassword)
        setEmailStatus({
          sent: result.data.emailSent ?? false,
          error: result.data.emailError,
        })
        router.refresh()
      }
    }
  }

  const handleDeactivate = async (u: UserWithRole) => {
    if (!confirm(`Deactivate ${u.first_name} ${u.last_name}? They will no longer be able to sign in.`)) return
    const result = await deactivateUser(u.id)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const handleReactivate = async (u: UserWithRole) => {
    if (!confirm(`Reactivate ${u.first_name} ${u.last_name}?`)) return
    const result = await reactivateUser(u.id)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const openResetPassword = (u: UserWithRole) => {
    setResetTarget(u)
    setResetPwd('')
    setResetConfirm('')
    setResetError('')
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return
    if (resetPwd.length < 8) {
      setResetError('Password must be at least 8 characters.')
      return
    }
    if (resetPwd !== resetConfirm) {
      setResetError('Passwords do not match.')
      return
    }
    setResetting(true)
    setResetError('')
    const result = await resetPassword(resetTarget.id, resetPwd)
    setResetting(false)
    if (result.error) {
      setResetError(result.error)
    } else {
      setResetTarget(null)
      router.refresh()
    }
  }

  const handleClearPasskeys = async () => {
    if (!clearPasskeyTarget) return
    setClearingPasskeys(true)
    const result = await clearUserPasskeysAction(clearPasskeyTarget.id)
    setClearingPasskeys(false)
    if (result.error) {
      alert(result.error)
    } else {
      setLocalPasskeyCounts(prev => ({ ...prev, [clearPasskeyTarget.id]: 0 }))
      setClearPasskeyTarget(null)
      router.refresh()
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk invite helpers
  // ---------------------------------------------------------------------------

  const openBulkInvite = () => {
    setBulkText('')
    setBulkRoleId('')
    setBulkError('')
    setBulkResults(null)
    setBulkSendEmails(true)
    setShowBulkInvite(true)
  }

  function parseBulkEntries(text: string): { entries: { email: string; firstName: string; lastName: string }[]; errors: string[] } {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const entries: { email: string; firstName: string; lastName: string }[] = []
    const errors: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Support formats:
      // email@domain.com                       → derive name from email local part
      // First Last, email@domain.com
      // First Last <email@domain.com>
      // email@domain.com, First Last

      let email = ''
      let firstName = ''
      let lastName = ''

      // Try "Name <email>" format
      const angleMatch = line.match(/^(.+?)\s*<([^>]+@[^>]+)>$/)
      if (angleMatch) {
        const nameParts = angleMatch[1].trim().split(/\s+/)
        email = angleMatch[2].trim()
        firstName = nameParts[0] || ''
        lastName = nameParts.slice(1).join(' ') || ''
      } else {
        // Split by comma
        const parts = line.split(',').map(p => p.trim())
        if (parts.length === 1) {
          // Just an email
          email = parts[0]
        } else {
          // Figure out which part is the email
          const emailPart = parts.find(p => p.includes('@'))
          const namePart = parts.find(p => !p.includes('@'))
          if (emailPart) {
            email = emailPart
            if (namePart) {
              const nameParts = namePart.split(/\s+/)
              firstName = nameParts[0] || ''
              lastName = nameParts.slice(1).join(' ') || ''
            }
          } else {
            errors.push(`Line ${i + 1}: No email address found — "${line}"`)
            continue
          }
        }
      }

      email = email.trim().toLowerCase()

      // Derive name from email if not provided
      if (!firstName) {
        const local = email.split('@')[0] || ''
        const nameParts = local.split(/[._-]/)
        firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : ''
        lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : ''
      }

      if (!firstName || !lastName) {
        errors.push(`Line ${i + 1}: Could not determine first and last name — "${line}". Use format: First Last, email@domain.com`)
        continue
      }

      if (!email.includes('@') || !email.includes('.')) {
        errors.push(`Line ${i + 1}: Invalid email — "${email}"`)
        continue
      }

      entries.push({ email, firstName, lastName })
    }

    // Check for duplicates
    const seen = new Set<string>()
    const deduped: typeof entries = []
    for (const e of entries) {
      if (seen.has(e.email)) {
        errors.push(`Duplicate email: ${e.email}`)
      } else {
        seen.add(e.email)
        deduped.push(e)
      }
    }

    return { entries: deduped, errors }
  }

  const bulkParsed = bulkText.trim() ? parseBulkEntries(bulkText) : { entries: [], errors: [] }

  const handleBulkInvite = async () => {
    if (bulkParsed.entries.length === 0) {
      setBulkError('No valid entries to invite.')
      return
    }
    if (!bulkRoleId) {
      setBulkError('Please select a role.')
      return
    }
    setBulkSaving(true)
    setBulkError('')
    const result = await bulkInviteUsers(bulkParsed.entries, bulkRoleId, bulkSendEmails)
    setBulkSaving(false)
    setBulkResults(result.results)
    router.refresh()
  }

  // ---------------------------------------------------------------------------

  const previewInitials = form.initials || (form.first_name && form.last_name
    ? (form.first_name[0] + form.last_name[0]).toUpperCase()
    : '??')

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.display_name }))

  const columns: Column<UserWithRole>[] = [
    {
      key: 'avatar',
      label: '',
      render: (r) => (
        <div className={!r.is_active ? 'opacity-40' : ''}>
          <Avatar user={r} size={32} />
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (r) => (
        <span className={`font-semibold ${!r.is_active ? 'text-slate-400' : ''}`}>
          {r.first_name} {r.last_name}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (r) => (
        <span className={!r.is_active ? 'text-slate-400' : ''}>
          {r.email}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      nowrap: true,
      render: (r) => {
        const role = r.roles as unknown as { name: string; display_name: string }
        const cfg = role ? ROLE_CONFIG[role.name] : null
        return cfg ? (
          <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
        ) : (
          role?.display_name || 'Unknown'
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r) =>
        r.is_active ? (
          <Badge label="Active" color="#059669" bg="#ecfdf5" />
        ) : (
          <Badge label="Inactive" color="#9ca3af" bg="#f3f4f6" />
        ),
    },
    {
      key: 'mailbox',
      label: 'Email Sending',
      nowrap: true,
      render: (r) => {
        const cred = getMailCred(r.id)
        if (!r.is_active) return <span className="text-xs text-slate-300">&mdash;</span>
        if (cred) {
          return (
            <span title={`Connected mailbox: ${cred.email_address}`} className="cursor-help">
              <Badge label="Connected" color="#059669" bg="#ecfdf5" />
            </span>
          )
        }
        return <Badge label="Not connected" color="#9ca3af" bg="#f3f4f6" />
      },
    },
  ]

  if (showActions) {
    columns.push({
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => {
        const isSelf = r.id === currentUser.id
        return (
          <div className="flex items-center justify-end gap-1">
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); openEdit(r) }}
              >
                Edit
              </Button>
            )}
            {canEdit && r.is_active && !getMailCred(r.id) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); handleConnectMailbox(r.id) }}
                disabled={connectingMailFor === r.id}
              >
                {connectingMailFor === r.id ? 'Connecting...' : 'Connect Mailbox'}
              </Button>
            )}
            {canEdit && r.is_active && getMailCred(r.id) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); handleDisconnectMailbox(r.id) }}
              >
                Disconnect
              </Button>
            )}
            {canEdit && !isSelf && r.is_active && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); openResetPassword(r) }}
              >
                Reset Password
              </Button>
            )}
            {canEdit && !isSelf && r.is_active && (localPasskeyCounts[r.id] ?? 0) > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); setClearPasskeyTarget(r) }}
              >
                Clear Passkeys ({localPasskeyCounts[r.id]})
              </Button>
            )}
            {canDelete && !isSelf && r.is_active && (
              <Button
                size="sm"
                variant="danger"
                onClick={(e) => { e.stopPropagation(); handleDeactivate(r) }}
              >
                Deactivate
              </Button>
            )}
            {canEdit && !r.is_active && (
              <Button
                size="sm"
                variant="success"
                onClick={(e) => { e.stopPropagation(); handleReactivate(r) }}
              >
                Reactivate
              </Button>
            )}
          </div>
        )
      },
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="text"
          placeholder="Search team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400 dark:focus:border-slate-500"
        />
        <Checkbox
          label="Show inactive"
          checked={showInactive}
          onChange={setShowInactive}
        />
        <div className="flex-1" />
        {canCreate && (
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={openBulkInvite}>
              Bulk Invite
            </Button>
            <Button variant="primary" size="sm" onClick={openInvite}>
              + Invite Team Member
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No team members found."
      />

      {/* Reset Password Modal */}
      {resetTarget && (
        <Modal
          title={`Reset Password — ${resetTarget.first_name} ${resetTarget.last_name}`}
          onClose={() => setResetTarget(null)}
          width={440}
        >
          {resetError && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
              {resetError}
            </div>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Set a new password for this user. They will be required to change it on next login.
          </p>
          <div className="space-y-3">
            <Input
              label="New Password *"
              type="password"
              value={resetPwd}
              onChange={setResetPwd}
              placeholder="Minimum 8 characters"
            />
            <Input
              label="Confirm Password *"
              type="password"
              value={resetConfirm}
              onChange={setResetConfirm}
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleResetPassword}
              disabled={!resetPwd || !resetConfirm || resetting}
            >
              {resetting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Clear Passkeys Modal */}
      {clearPasskeyTarget && (
        <Modal
          title={`Clear Passkeys — ${clearPasskeyTarget.first_name} ${clearPasskeyTarget.last_name}`}
          onClose={() => setClearPasskeyTarget(null)}
          width={440}
        >
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Clear all passkeys for this user? They will need to use an alternative sign-in method (magic link or password) and can re-register passkeys from Settings.
          </p>
          <p className="text-xs text-slate-400 mb-5">
            {localPasskeyCounts[clearPasskeyTarget.id] ?? 0} passkey{(localPasskeyCounts[clearPasskeyTarget.id] ?? 0) !== 1 ? 's' : ''} registered
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setClearPasskeyTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleClearPasskeys}
              disabled={clearingPasskeys}
            >
              {clearingPasskeys ? 'Clearing...' : 'Clear Passkeys'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Single Invite / Edit Modal */}
      {showForm && (
        <Modal
          title={editing ? 'Edit Team Member' : 'Invite Team Member'}
          onClose={() => { setShowForm(false); setTempPassword(null); setEmailStatus(null) }}
          width={520}
        >
          {tempPassword ? (
            <div>
              <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-2">
                  Account created successfully!
                </p>
                {emailStatus?.sent ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-3">
                    A welcome email with login credentials has been sent to {form.email}.
                  </p>
                ) : (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-3">
                    Share these credentials with {form.first_name}:
                  </p>
                )}
                <div className="rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 p-3 font-mono text-sm">
                  <div><span className="text-slate-500">Email:</span> {form.email}</div>
                  <div><span className="text-slate-500">Password:</span> {tempPassword}</div>
                </div>
                {emailStatus && !emailStatus.sent && emailStatus.error && (
                  <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                    Welcome email could not be sent: {emailStatus.error}
                  </p>
                )}
                <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-500">
                  They will be asked to change this password after first login.
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setShowForm(false); setTempPassword(null); setEmailStatus(null) }}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* Avatar preview */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 overflow-hidden"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: form.color,
                    fontSize: 19,
                  }}
                >
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    previewInitials
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {form.first_name || form.last_name
                      ? `${form.first_name} ${form.last_name}`.trim()
                      : 'Preview'}
                  </div>
                  {editing && (
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                      >
                        {avatarUploading ? 'Uploading...' : form.avatar_url ? 'Replace photo' : 'Upload photo'}
                      </button>
                      {form.avatar_url && (
                        <>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={handleAvatarRemove}
                            disabled={avatarUploading}
                            className="text-[11px] font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </>
                      )}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleAvatarUpload(file)
                          e.target.value = ''
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="First Name *"
                  value={form.first_name}
                  onChange={upd('first_name')}
                />
                <Input
                  label="Last Name *"
                  value={form.last_name}
                  onChange={upd('last_name')}
                />
                <Input
                  label="Email *"
                  type="email"
                  value={form.email}
                  onChange={upd('email')}
                  className="col-span-2"
                />
                <Select
                  label="Role *"
                  options={roleOptions}
                  placeholder="Select role..."
                  value={form.role_id}
                  onChange={upd('role_id')}
                  className="col-span-2"
                />

                {/* Colour picker */}
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Avatar Colour
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLOURS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`w-8 h-8 rounded-full cursor-pointer transition-all ${
                          form.color === c
                            ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {editing && (
                  <Input
                    label="Initials (auto-generated)"
                    value={form.initials}
                    onChange={upd('initials')}
                    placeholder={(form.first_name[0] || '') + (form.last_name[0] || '')}
                  />
                )}

                {/* Send welcome email checkbox — only for new invites */}
                {!editing && (
                  <div className="col-span-2">
                    <Checkbox
                      label="Send welcome email with login credentials"
                      checked={sendEmail}
                      onChange={setSendEmail}
                    />
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setShowForm(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={
                    !form.first_name.trim() ||
                    !form.last_name.trim() ||
                    !form.email.trim() ||
                    !form.role_id ||
                    saving
                  }
                >
                  {saving
                    ? 'Saving...'
                    : editing
                    ? 'Save Changes'
                    : 'Send Invite'}
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Bulk Invite Modal */}
      {showBulkInvite && (
        <Modal
          title="Bulk Invite Team Members"
          onClose={() => { setShowBulkInvite(false); setBulkResults(null) }}
          width={600}
        >
          {bulkResults ? (
            <div>
              {/* Results summary */}
              {(() => {
                const succeeded = bulkResults.filter(r => r.success)
                const failed = bulkResults.filter(r => !r.success)
                const emailsSent = succeeded.filter(r => r.emailSent).length
                return (
                  <>
                    <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        {succeeded.length} of {bulkResults.length} accounts created
                        {emailsSent > 0 && ` — ${emailsSent} welcome email${emailsSent !== 1 ? 's' : ''} sent`}
                      </p>
                    </div>

                    {/* Individual results */}
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {bulkResults.map((r, i) => (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 text-sm ${
                            r.success
                              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                              : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{r.email}</span>
                            {r.success ? (
                              <div className="flex items-center gap-2">
                                {r.emailSent && (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Email sent</span>
                                )}
                                <Badge label="Created" color="#059669" bg="#ecfdf5" />
                              </div>
                            ) : (
                              <Badge label="Failed" color="#dc2626" bg="#fef2f2" />
                            )}
                          </div>
                          {r.success && r.tempPassword && !r.emailSent && (
                            <div className="mt-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-mono text-xs">
                              <span className="text-slate-400">Password:</span> {r.tempPassword}
                            </div>
                          )}
                          {!r.success && r.error && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{r.error}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Failed accounts — show passwords for any that succeeded without email */}
                    {succeeded.filter(r => !r.emailSent).length > 0 && (
                      <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Accounts created without welcome emails are shown with their temporary passwords above. Share these credentials manually.
                        </p>
                      </div>
                    )}

                    {failed.length > 0 && (
                      <div className="mt-4">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            // Pre-fill textarea with failed entries for retry
                            const failedText = failed.map(r => r.email).join('\n')
                            setBulkText(failedText)
                            setBulkResults(null)
                          }}
                        >
                          Retry {failed.length} Failed
                        </Button>
                      </div>
                    )}
                  </>
                )
              })()}
              <div className="mt-5 flex justify-end">
                <Button onClick={() => { setShowBulkInvite(false); setBulkResults(null) }}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              {bulkError && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                  {bulkError}
                </div>
              )}

              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Enter one person per line. Accepted formats:
              </p>
              <div className="mb-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
                <div>First Last, email@domain.com</div>
                <div>First Last &lt;email@domain.com&gt;</div>
                <div>email@domain.com <span className="text-slate-400">← name derived from email</span></div>
              </div>

              <textarea
                rows={8}
                value={bulkText}
                onChange={(e) => { setBulkText(e.target.value); setBulkError('') }}
                placeholder={'Jane Smith, jane.smith@company.com\nJohn Doe <john.doe@company.com>\nbob.jones@company.com'}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />

              {/* Preview parsed entries */}
              {bulkParsed.entries.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {bulkParsed.entries.length} {bulkParsed.entries.length === 1 ? 'person' : 'people'} to invite
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {bulkParsed.entries.map((e, i) => (
                      <div key={i} className="px-3 py-1.5 flex items-center gap-3 text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{e.firstName} {e.lastName}</span>
                        <span className="text-slate-400">{e.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parse errors */}
              {bulkParsed.errors.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Issues found:</p>
                  {bulkParsed.errors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-600 dark:text-amber-400">{err}</p>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <Select
                  label="Role for all invitees *"
                  options={roleOptions}
                  placeholder="Select role..."
                  value={bulkRoleId}
                  onChange={setBulkRoleId}
                />
              </div>

              <div className="mt-4">
                <Checkbox
                  label="Send welcome emails with login credentials"
                  checked={bulkSendEmails}
                  onChange={setBulkSendEmails}
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setShowBulkInvite(false)}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleBulkInvite}
                  disabled={bulkParsed.entries.length === 0 || !bulkRoleId || bulkSaving}
                >
                  {bulkSaving
                    ? `Inviting ${bulkParsed.entries.length}...`
                    : `Invite ${bulkParsed.entries.length} ${bulkParsed.entries.length === 1 ? 'Person' : 'People'}`}
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
