'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Avatar } from '@/components/ui/avatar'
import { Badge, ROLE_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Checkbox } from '@/components/ui/form-fields'
import { useAuth } from '@/components/auth-provider'
import { inviteUser, updateUser, deactivateUser, reactivateUser } from './actions'
import type { User, Role } from '@/types/database'

type UserWithRole = User & { roles: { id: string; name: string; display_name: string } }

interface TeamTableProps {
  users: UserWithRole[]
  roles: Pick<Role, 'id' | 'name' | 'display_name'>[]
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
}

export function TeamTable({ users, roles }: TeamTableProps) {
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
    })
    setError('')
    setTempPassword(null)
    setShowForm(true)
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
      render: (r) =>
        r.is_active ? (
          <Badge label="Active" color="#059669" bg="#ecfdf5" />
        ) : (
          <Badge label="Inactive" color="#9ca3af" bg="#f3f4f6" />
        ),
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
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <Checkbox
          label="Show inactive"
          checked={showInactive}
          onChange={setShowInactive}
        />
        <div className="flex-1" />
        {canCreate && (
          <Button variant="primary" onClick={openInvite}>
            + Invite Team Member
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No team members found."
      />

      {showForm && (
        <Modal
          title={editing ? 'Edit Team Member' : 'Invite Team Member'}
          onClose={() => { setShowForm(false); setTempPassword(null) }}
          width={520}
        >
          {tempPassword ? (
            <div>
              <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-sm font-medium text-emerald-800 mb-2">
                  Account created successfully!
                </p>
                <p className="text-sm text-emerald-700 mb-3">
                  Share these credentials with {form.first_name}:
                </p>
                <div className="rounded-lg bg-white border border-emerald-200 p-3 font-mono text-sm">
                  <div><span className="text-slate-500">Email:</span> {form.email}</div>
                  <div><span className="text-slate-500">Password:</span> {tempPassword}</div>
                </div>
                <p className="mt-3 text-xs text-emerald-600">
                  They should change this password after first login.
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setShowForm(false); setTempPassword(null) }}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Avatar preview */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: form.color,
                    fontSize: 19,
                  }}
                >
                  {previewInitials}
                </div>
                <div className="text-sm text-slate-500">
                  {form.first_name || form.last_name
                    ? `${form.first_name} ${form.last_name}`.trim()
                    : 'Preview'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="mb-1 block text-xs font-medium text-slate-500">
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
                            ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
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
    </div>
  )
}
