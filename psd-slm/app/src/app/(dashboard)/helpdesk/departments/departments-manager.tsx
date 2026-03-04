'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addDepartmentMember,
  removeDepartmentMember,
  updateMemberRole,
} from '../actions'
import type { EscalationType, DepartmentMemberRole } from '@/types/database'
import { generateUUID } from '@/lib/utils'

interface DeptMember {
  id: string
  user_id: string
  role: string
  first_name: string
  last_name: string
  initials: string | null
  color: string | null
}

interface DepartmentData {
  id: string
  name: string
  description: string | null
  escalation_type: EscalationType
  priority_uplift: number
  is_active: boolean
  display_order: number
  members: DeptMember[]
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  initials: string | null
  color: string | null
}

interface DepartmentsManagerProps {
  initialData: DepartmentData[]
  teamMembers: TeamMember[]
}

export function DepartmentsManager({ initialData, teamMembers }: DepartmentsManagerProps) {
  const router = useRouter()
  const [departments, setDepartments] = useState(initialData)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<DepartmentData | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    escalation_type: 'sideways' as EscalationType,
    priority_uplift: 1,
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', escalation_type: 'sideways', priority_uplift: 1 })
    setShowModal(true)
  }

  function openEdit(dept: DepartmentData) {
    setEditing(dept)
    setForm({
      name: dept.name,
      description: dept.description || '',
      escalation_type: dept.escalation_type,
      priority_uplift: dept.priority_uplift || 1,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const result = await updateDepartment(editing.id, {
          name: form.name,
          description: form.description || null,
          escalation_type: form.escalation_type,
          priority_uplift: form.escalation_type === 'upward' ? form.priority_uplift : 0,
        })
        if (!result.error) {
          setDepartments(prev => prev.map(d =>
            d.id === editing.id ? {
              ...d,
              name: form.name,
              description: form.description || null,
              escalation_type: form.escalation_type,
              priority_uplift: form.escalation_type === 'upward' ? form.priority_uplift : 0,
            } : d
          ))
        }
      } else {
        const result = await createDepartment({
          name: form.name,
          description: form.description || undefined,
          escalation_type: form.escalation_type,
          priority_uplift: form.escalation_type === 'upward' ? form.priority_uplift : undefined,
        })
        if (result.data) {
          setDepartments(prev => [...prev, { ...result.data, members: [] } as DepartmentData])
        }
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this department? Members will be removed and tickets will be unassigned from it.')) return
    const result = await deleteDepartment(id)
    if (!result.error) {
      setDepartments(prev => prev.filter(d => d.id !== id))
    }
  }

  async function handleToggleActive(dept: DepartmentData) {
    const result = await updateDepartment(dept.id, { is_active: !dept.is_active })
    if (!result.error) {
      setDepartments(prev => prev.map(d =>
        d.id === dept.id ? { ...d, is_active: !d.is_active } : d
      ))
    }
  }

  async function handleAddMember(deptId: string, userId: string) {
    const result = await addDepartmentMember(deptId, userId, 'member')
    if (!result.error) {
      const tm = teamMembers.find(m => m.id === userId)
      if (tm) {
        setDepartments(prev => prev.map(d =>
          d.id === deptId ? {
            ...d,
            members: [...d.members, {
              id: generateUUID(),
              user_id: userId,
              role: 'member',
              first_name: tm.first_name,
              last_name: tm.last_name,
              initials: tm.initials,
              color: tm.color,
            }],
          } : d
        ))
      }
      setAddingMemberTo(null)
    }
  }

  async function handleRemoveMember(deptId: string, userId: string) {
    const result = await removeDepartmentMember(deptId, userId)
    if (!result.error) {
      setDepartments(prev => prev.map(d =>
        d.id === deptId ? {
          ...d,
          members: d.members.filter(m => m.user_id !== userId),
        } : d
      ))
    }
  }

  async function handleToggleRole(deptId: string, userId: string, currentRole: string) {
    const newRole: DepartmentMemberRole = currentRole === 'manager' ? 'member' : 'manager'
    const result = await updateMemberRole(deptId, userId, newRole)
    if (!result.error) {
      setDepartments(prev => prev.map(d =>
        d.id === deptId ? {
          ...d,
          members: d.members.map(m =>
            m.user_id === userId ? { ...m, role: newRole } : m
          ),
        } : d
      ))
    }
  }

  function getNonMembers(dept: DepartmentData) {
    const memberIds = new Set(dept.members.map(m => m.user_id))
    return teamMembers.filter(tm => !memberIds.has(tm.id))
  }

  return (
    <div>
      <div className="mb-8 flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Department
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-slate-400">
          No departments configured yet. Add one to enable department-based escalation routing.
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map(dept => (
            <div key={dept.id} className={`rounded-xl border bg-white ${dept.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              {/* Department header */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <svg className={`h-4 w-4 transition-transform ${expandedDept === dept.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{dept.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        dept.escalation_type === 'upward'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {dept.escalation_type === 'upward' ? `Upward (+${dept.priority_uplift})` : 'Sideways'}
                      </span>
                      {!dept.is_active && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    {dept.description && (
                      <p className="mt-0.5 text-xs text-slate-400">{dept.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{dept.members.length} member{dept.members.length !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => handleToggleActive(dept)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      dept.is_active ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      dept.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`} />
                  </button>
                  <button
                    onClick={() => openEdit(dept)}
                    className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-gray-50 hover:text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(dept.id)}
                    className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded member management */}
              {expandedDept === dept.id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Members</h4>
                    <div className="relative">
                      <button
                        onClick={() => setAddingMemberTo(addingMemberTo === dept.id ? null : dept.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        + Add Member
                      </button>
                      {addingMemberTo === dept.id && (
                        <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                          {getNonMembers(dept).length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400">All team members are already added</div>
                          ) : (
                            getNonMembers(dept).map(tm => (
                              <button
                                key={tm.id}
                                onClick={() => handleAddMember(dept.id, tm.id)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                              >
                                <span
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white"
                                  style={{ backgroundColor: tm.color || '#6b7280' }}
                                >
                                  {tm.initials || `${tm.first_name[0]}${tm.last_name[0]}`}
                                </span>
                                {tm.first_name} {tm.last_name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {dept.members.length === 0 ? (
                    <p className="text-xs text-slate-300">No members assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {dept.members.map(member => (
                        <div key={member.user_id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-medium text-white"
                              style={{ backgroundColor: member.color || '#6b7280' }}
                            >
                              {member.initials || `${member.first_name[0]}${member.last_name[0]}`}
                            </span>
                            <span className="text-sm text-slate-700">{member.first_name} {member.last_name}</span>
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              member.role === 'manager'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {member.role === 'manager' ? 'Manager' : 'Member'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleRole(dept.id, member.user_id, member.role)}
                              className="text-[11px] text-slate-400 hover:text-slate-600"
                            >
                              {member.role === 'manager' ? 'Set as Member' : 'Set as Manager'}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(dept.id, member.user_id)}
                              className="text-[11px] text-red-400 hover:text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              {editing ? 'Edit Department' : 'Add Department'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Service Desk"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What this department handles..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Escalation Type</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="escalation_type"
                      value="sideways"
                      checked={form.escalation_type === 'sideways'}
                      onChange={() => setForm({ ...form, escalation_type: 'sideways' })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">Sideways</div>
                      <div className="text-xs text-slate-400">Route to another team — no priority change, no level increment</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="escalation_type"
                      value="upward"
                      checked={form.escalation_type === 'upward'}
                      onChange={() => setForm({ ...form, escalation_type: 'upward' })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">Upward</div>
                      <div className="text-xs text-slate-400">Escalate to higher tier — increments level and bumps priority</div>
                    </div>
                  </label>
                </div>
              </div>
              {form.escalation_type === 'upward' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Priority Uplift</label>
                  <select
                    value={form.priority_uplift}
                    onChange={e => setForm({ ...form, priority_uplift: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={1}>+1 level (e.g. Low to Medium)</option>
                    <option value={2}>+2 levels (e.g. Low to High)</option>
                    <option value={3}>+3 levels (e.g. Low to Urgent)</option>
                  </select>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
