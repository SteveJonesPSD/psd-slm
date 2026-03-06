'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea } from '@/components/ui/form-fields'
import { Badge, ROLE_CONFIG } from '@/components/ui/badge'
import { createRole, updateRole, deleteRole, saveRolePermissions } from './actions'
import type { Role, Permission } from '@/types/database'

// Module display order + human labels
const MODULE_ORDER: { key: string; label: string }[] = [
  { key: 'customers', label: 'Customers' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'pipeline', label: 'Pipeline (Opportunities)' },
  { key: 'deal_registrations', label: 'Deal Registrations' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'templates', label: 'Quote Templates' },
  { key: 'sales_orders', label: 'Sales Orders' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
  { key: 'inbound_pos', label: 'Inbound POs' },
  { key: 'invoices', label: 'Invoicing' },
  { key: 'commission', label: 'Commission' },
  { key: 'products', label: 'Products' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'stock', label: 'Stock' },
  { key: 'delivery_notes', label: 'Delivery Notes' },
  { key: 'helpdesk', label: 'Service Desk' },
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'visit_scheduling', label: 'Visit Scheduling' },
  { key: 'collections', label: 'Collections' },
  { key: 'email', label: 'Email Integration' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
  { key: 'team', label: 'Team' },
]

// Friendly action labels
const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit_own: 'Edit Own',
  edit_all: 'Edit All',
  edit: 'Edit',
  delete: 'Delete',
  export: 'Export',
  admin: 'Admin',
  process: 'Process',
  confirm: 'Confirm',
}

interface RolesAdminProps {
  initialRoles: (Role & { user_count: number })[]
  permissions: Permission[]
  rolePermMap: Record<string, string[]>
  canEdit: boolean
}

export function RolesAdmin({ initialRoles, permissions, rolePermMap, canEdit }: RolesAdminProps) {
  const router = useRouter()
  const [roles, setRoles] = useState(initialRoles)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    initialRoles[0]?.id ?? null
  )
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<(Role & { user_count: number }) | null>(null)

  // Permission editing state
  const [dirtyPermissions, setDirtyPermissions] = useState<Record<string, Set<string>>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  )

  // Get current permission IDs for the selected role (dirty state or from server)
  const getPermissionIds = useCallback(
    (roleId: string): Set<string> => {
      if (dirtyPermissions[roleId]) return dirtyPermissions[roleId]
      return new Set(rolePermMap[roleId] ?? [])
    },
    [dirtyPermissions, rolePermMap]
  )

  const isDirty = selectedRoleId ? !!dirtyPermissions[selectedRoleId] : false

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const map: Record<string, Permission[]> = {}
    for (const p of permissions) {
      if (!map[p.module]) map[p.module] = []
      map[p.module].push(p)
    }
    return map
  }, [permissions])

  // Ordered modules (only those that have permissions)
  const orderedModules = useMemo(() => {
    const known = MODULE_ORDER.filter((m) => permissionsByModule[m.key])
    // Include any modules not in MODULE_ORDER
    const knownKeys = new Set(known.map((m) => m.key))
    const extra = Object.keys(permissionsByModule)
      .filter((k) => !knownKeys.has(k))
      .map((k) => ({ key: k, label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))
    return [...known, ...extra]
  }, [permissionsByModule])

  const togglePermission = (permId: string) => {
    if (!selectedRoleId || !canEdit || selectedRole?.is_system) return
    setMessage(null)
    setDirtyPermissions((prev) => {
      const current = prev[selectedRoleId]
        ? new Set(prev[selectedRoleId])
        : new Set(rolePermMap[selectedRoleId] ?? [])
      if (current.has(permId)) {
        current.delete(permId)
      } else {
        current.add(permId)
      }
      return { ...prev, [selectedRoleId]: current }
    })
  }

  const toggleAllModule = (moduleKey: string, grant: boolean) => {
    if (!selectedRoleId || !canEdit || selectedRole?.is_system) return
    setMessage(null)
    const modulePerms = permissionsByModule[moduleKey] ?? []
    setDirtyPermissions((prev) => {
      const current = prev[selectedRoleId]
        ? new Set(prev[selectedRoleId])
        : new Set(rolePermMap[selectedRoleId] ?? [])
      for (const p of modulePerms) {
        if (grant) {
          current.add(p.id)
        } else {
          current.delete(p.id)
        }
      }
      return { ...prev, [selectedRoleId]: current }
    })
  }

  const handleSave = async () => {
    if (!selectedRoleId || !dirtyPermissions[selectedRoleId]) return
    setSaving(true)
    setMessage(null)
    const result = await saveRolePermissions(
      selectedRoleId,
      Array.from(dirtyPermissions[selectedRoleId])
    )
    setSaving(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      // Update local rolePermMap equivalent and clear dirty state
      rolePermMap[selectedRoleId] = Array.from(dirtyPermissions[selectedRoleId])
      setDirtyPermissions((prev) => {
        const next = { ...prev }
        delete next[selectedRoleId]
        return next
      })
      setMessage({ type: 'success', text: 'Permissions saved.' })
    }
  }

  const handleDiscard = () => {
    if (!selectedRoleId) return
    setDirtyPermissions((prev) => {
      const next = { ...prev }
      delete next[selectedRoleId]
      return next
    })
    setMessage(null)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left Panel — Role List */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Roles</h3>
            {canEdit && (
              <Button size="sm" variant="primary" onClick={() => setShowCreateModal(true)}>
                + Add Role
              </Button>
            )}
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700">
            {roles.map((role) => {
              const isActive = role.id === selectedRoleId
              const cfg = ROLE_CONFIG[role.name]
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => { setSelectedRoleId(role.id); setMessage(null) }}
                  className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-3 border-indigo-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-3 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-sm font-medium ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-200'}`}>
                        {role.display_name}
                      </span>
                      {role.is_system && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {role.user_count} user{role.user_count !== 1 ? 's' : ''}
                      </span>
                      {cfg && <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />}
                    </div>
                  </div>
                  {role.description && (
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
                      {role.description}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Panel — Permission Matrix */}
      <div className="min-w-0 flex-1">
        {selectedRole ? (
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4 rounded-t-xl">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedRole.display_name}
                </h3>
                {canEdit && !selectedRole.is_system && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingRole(selectedRole)}
                      className="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      Edit
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(selectedRole)}
                      className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {message && (
                  <p className={`text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {message.text}
                  </p>
                )}
                {isDirty && !selectedRole.is_system && (
                  <>
                    <Button size="sm" onClick={handleDiscard}>Discard</Button>
                    <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* System role banner */}
            {selectedRole.is_system && (
              <div className="mx-5 mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-700 dark:text-amber-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                System roles always have full access. Permissions cannot be modified.
              </div>
            )}

            {/* Permission Grid */}
            <div className="p-5 space-y-4">
              {orderedModules.map(({ key: moduleKey, label: moduleLabel }) => {
                const modulePerms = permissionsByModule[moduleKey] ?? []
                if (modulePerms.length === 0) return null
                const currentPermIds = getPermissionIds(selectedRole.id)
                const allChecked = modulePerms.every((p) => currentPermIds.has(p.id))
                const someChecked = modulePerms.some((p) => currentPermIds.has(p.id))

                return (
                  <div
                    key={moduleKey}
                    className="rounded-lg border border-gray-100 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-t-lg">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        {moduleLabel}
                      </span>
                      {canEdit && !selectedRole.is_system && (
                        <button
                          type="button"
                          onClick={() => toggleAllModule(moduleKey, !allChecked)}
                          className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                        >
                          {allChecked ? 'Revoke All' : 'Grant All'}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3">
                      {modulePerms.map((perm) => {
                        const checked = currentPermIds.has(perm.id)
                        const disabled = !canEdit || selectedRole.is_system
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-2 text-sm cursor-pointer select-none ${
                              disabled ? 'opacity-60 cursor-default' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(perm.id)}
                              disabled={disabled}
                              className="rounded border-slate-300 dark:border-slate-500 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-slate-700 dark:text-slate-300">
                              {ACTION_LABELS[perm.action] ?? perm.action}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
            <p className="text-sm text-slate-400">Select a role to view its permissions.</p>
          </div>
        )}
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <CreateRoleModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(role) => {
            setRoles((prev) => [...prev, { ...role, user_count: 0 }])
            setSelectedRoleId(role.id)
            setShowCreateModal(false)
            router.refresh()
          }}
        />
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <EditRoleModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={(updates) => {
            setRoles((prev) =>
              prev.map((r) =>
                r.id === editingRole.id ? { ...r, ...updates } : r
              )
            )
            setEditingRole(null)
            router.refresh()
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <DeleteRoleModal
          role={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onDeleted={() => {
            setRoles((prev) => prev.filter((r) => r.id !== deleteConfirm.id))
            if (selectedRoleId === deleteConfirm.id) {
              setSelectedRoleId(roles.find((r) => r.id !== deleteConfirm.id)?.id ?? null)
            }
            setDeleteConfirm(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// --- Sub-components ---

function CreateRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (role: Role) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const result = await createRole(name.trim(), name.trim(), description.trim() || undefined)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      onCreated(result.data as unknown as Role)
    }
  }

  return (
    <Modal title="Add Role" onClose={onClose} width={440}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <Input
          label="Role Name *"
          value={name}
          onChange={setName}
          placeholder="e.g. Project Manager"
        />
        <Textarea
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="What can this role do?"
          rows={2}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={!name.trim() || saving}
        >
          {saving ? 'Creating...' : 'Create Role'}
        </Button>
      </div>
    </Modal>
  )
}

function EditRoleModal({
  role,
  onClose,
  onSaved,
}: {
  role: Role
  onClose: () => void
  onSaved: (updates: { display_name?: string; description?: string }) => void
}) {
  const [displayName, setDisplayName] = useState(role.display_name)
  const [description, setDescription] = useState(role.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!displayName.trim()) return
    setSaving(true)
    setError('')
    const updates: { display_name?: string; description?: string } = {}
    if (displayName.trim() !== role.display_name) updates.display_name = displayName.trim()
    if (description.trim() !== (role.description ?? '')) updates.description = description.trim() || undefined
    const result = await updateRole(role.id, updates)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      onSaved(updates)
    }
  }

  return (
    <Modal title={`Edit Role — ${role.display_name}`} onClose={onClose} width={440}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <Input
          label="Display Name *"
          value={displayName}
          onChange={setDisplayName}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={setDescription}
          rows={2}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!displayName.trim() || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}

function DeleteRoleModal({
  role,
  onClose,
  onDeleted,
}: {
  role: Role & { user_count: number }
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    const result = await deleteRole(role.id)
    setDeleting(false)
    if (result.error) {
      setError(result.error)
    } else {
      onDeleted()
    }
  }

  return (
    <Modal title="Delete Role" onClose={onClose} width={440}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Are you sure you want to delete <strong>{role.display_name}</strong>?
        {role.user_count > 0 && (
          <span className="text-red-600"> This role has {role.user_count} user(s) assigned and cannot be deleted until they are reassigned.</span>
        )}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete Role'}
        </Button>
      </div>
    </Modal>
  )
}
