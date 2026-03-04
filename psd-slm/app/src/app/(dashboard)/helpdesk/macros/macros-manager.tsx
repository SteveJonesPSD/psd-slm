'use client'

import { useState } from 'react'
import type { AutomationMacro, TicketTag, MacroAction } from '@/types/database'
import { TICKET_STATUSES } from '@/lib/helpdesk'
import { createMacro, updateMacro, deleteMacro, toggleMacroActive } from '../actions'

const AVAILABLE_ROLES = ['super_admin', 'admin', 'engineering', 'sales', 'accounts', 'purchasing']

const ACTION_TYPES: { value: MacroAction['type']; label: string }[] = [
  { value: 'escalate', label: 'Escalate' },
  { value: 'set_status', label: 'Set Status' },
  { value: 'notify_users', label: 'Notify Users' },
  { value: 'notify_roles', label: 'Notify Roles' },
]

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  initials: string | null
  color: string | null
  roles: { name: string }[] | { name: string } | null
}

interface MacrosManagerProps {
  initialMacros: AutomationMacro[]
  tags: TicketTag[]
  teamMembers: TeamMember[]
}

interface FormAction {
  type: MacroAction['type']
  level?: number
  status?: string
  user_ids?: string[]
  role_names?: string[]
}

interface FormState {
  name: string
  description: string
  trigger_type: string
  trigger_tag_ids: string[]
  trigger_match: string
  actions: FormAction[]
}

const emptyForm: FormState = {
  name: '',
  description: '',
  trigger_type: 'tag_applied',
  trigger_tag_ids: [],
  trigger_match: 'any',
  actions: [{ type: 'escalate', level: 2 }],
}

export function MacrosManager({ initialMacros, tags, teamMembers }: MacrosManagerProps) {
  const [macros, setMacros] = useState(initialMacros)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AutomationMacro | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(macro: AutomationMacro) {
    setEditing(macro)
    const conditions = macro.trigger_conditions as Record<string, unknown>
    setForm({
      name: macro.name,
      description: macro.description || '',
      trigger_type: macro.trigger_type,
      trigger_tag_ids: (conditions.tag_ids as string[]) || [],
      trigger_match: (conditions.match as string) || 'any',
      actions: (macro.actions as FormAction[]) || [{ type: 'escalate', level: 2 }],
    })
    setShowModal(true)
  }

  function buildPayload() {
    const trigger_conditions: Record<string, unknown> =
      form.trigger_type === 'tag_applied'
        ? { tag_ids: form.trigger_tag_ids, match: form.trigger_match }
        : {}

    return {
      name: form.name,
      description: form.description || undefined,
      trigger_type: form.trigger_type,
      trigger_conditions,
      actions: form.actions as unknown as Record<string, unknown>[],
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = buildPayload()
      if (editing) {
        const result = await updateMacro(editing.id, payload)
        if (!result.error) {
          setMacros(
            macros.map((m) =>
              m.id === editing.id
                ? ({
                    ...m,
                    name: form.name,
                    description: form.description || null,
                    trigger_type: form.trigger_type,
                    trigger_conditions: payload.trigger_conditions,
                    actions: form.actions,
                    updated_at: new Date().toISOString(),
                  } as AutomationMacro)
                : m
            )
          )
          setShowModal(false)
        }
      } else {
        const result = await createMacro(payload)
        if (result.data) {
          setMacros([...macros, result.data])
          setShowModal(false)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this macro?')) return
    const result = await deleteMacro(id)
    if (!result.error) {
      setMacros(macros.filter((m) => m.id !== id))
    }
  }

  async function handleToggleActive(macro: AutomationMacro) {
    const newVal = !macro.is_active
    const result = await toggleMacroActive(macro.id, newVal)
    if (!result.error) {
      setMacros(macros.map((m) => (m.id === macro.id ? { ...m, is_active: newVal } : m)))
    }
  }

  function addAction() {
    setForm({ ...form, actions: [...form.actions, { type: 'escalate', level: 2 }] })
  }

  function removeAction(index: number) {
    setForm({ ...form, actions: form.actions.filter((_, i) => i !== index) })
  }

  function updateAction(index: number, updates: Partial<FormAction>) {
    setForm({
      ...form,
      actions: form.actions.map((a, i) => (i === index ? { ...a, ...updates } : a)),
    })
  }

  function describeTrigger(macro: AutomationMacro): string {
    const conditions = macro.trigger_conditions as Record<string, unknown>
    if (macro.trigger_type === 'tag_applied') {
      const tagIds = (conditions.tag_ids as string[]) || []
      const match = (conditions.match as string) || 'any'
      const tagNamesList = tagIds
        .map((id) => tags.find((t) => t.id === id)?.name || '?')
        .join(', ')
      return `Tag ${match === 'all' ? 'all' : 'any'}: ${tagNamesList || 'none'}`
    }
    return macro.trigger_type
  }

  function describeActions(macro: AutomationMacro): string {
    return (macro.actions as FormAction[])
      .map((a) => {
        switch (a.type) {
          case 'escalate':
            return `Escalate L${a.level || 2}`
          case 'set_status':
            return `Status → ${a.status || '?'}`
          case 'notify_users':
            return `Notify ${(a.user_ids || []).length} user(s)`
          case 'notify_roles':
            return `Notify ${(a.role_names || []).join(', ')}`
          default:
            return a.type
        }
      })
      .join(', ')
  }

  function toggleTagId(tagId: string) {
    const ids = form.trigger_tag_ids.includes(tagId)
      ? form.trigger_tag_ids.filter((id) => id !== tagId)
      : [...form.trigger_tag_ids, tagId]
    setForm({ ...form, trigger_tag_ids: ids })
  }

  function toggleUserId(actionIndex: number, userId: string) {
    const action = form.actions[actionIndex]
    const ids = action.user_ids || []
    const updated = ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    updateAction(actionIndex, { user_ids: updated })
  }

  function toggleRoleName(actionIndex: number, role: string) {
    const action = form.actions[actionIndex]
    const names = action.role_names || []
    const updated = names.includes(role) ? names.filter((r) => r !== role) : [...names, role]
    updateAction(actionIndex, { role_names: updated })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Automation Macros</h1>
          <p className="text-sm text-slate-500">
            Configure automatic actions triggered by AI triage tags, priorities, or status changes.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New Macro
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Trigger</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Actions</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Active</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {macros.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No automation macros yet.
                </td>
              </tr>
            ) : (
              macros.map((macro) => (
                <tr key={macro.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{macro.name}</div>
                    {macro.description && (
                      <div className="text-xs text-slate-400">{macro.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{describeTrigger(macro)}</td>
                  <td className="px-4 py-3 text-slate-600">{describeActions(macro)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(macro)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        macro.is_active ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          macro.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(macro)}
                      className="mr-3 text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(macro.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editing ? 'Edit Macro' : 'New Macro'}
            </h2>

            <div className="space-y-5">
              {/* Name & Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. Compromise Alert"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Optional description"
                />
              </div>

              {/* Trigger */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Trigger</h3>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
                  <select
                    value={form.trigger_type}
                    onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                    className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="tag_applied">Tag Applied</option>
                    <option value="priority_set">Priority Set</option>
                    <option value="status_changed">Status Changed</option>
                  </select>
                </div>

                {form.trigger_type === 'tag_applied' && (
                  <>
                    <div className="mb-2">
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Match Mode
                      </label>
                      <select
                        value={form.trigger_match}
                        onChange={(e) => setForm({ ...form, trigger_match: e.target.value })}
                        className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="any">Any</option>
                        <option value="all">All</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Tags (AI-assignable only)
                      </label>
                      {tags.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          No AI-assignable tags configured. Mark tags as AI-assignable in the Tags
                          page first.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => toggleTagId(tag.id)}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                form.trigger_tag_ids.includes(tag.id)
                                  ? 'border-transparent text-white'
                                  : 'border-gray-300 bg-white text-slate-600 hover:border-gray-400'
                              }`}
                              style={
                                form.trigger_tag_ids.includes(tag.id)
                                  ? { backgroundColor: tag.color }
                                  : undefined
                              }
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Actions</h3>
                  <button
                    onClick={addAction}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Action
                  </button>
                </div>

                <div className="space-y-3">
                  {form.actions.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                      <div className="flex-1 space-y-2">
                        <select
                          value={action.type}
                          onChange={(e) =>
                            updateAction(idx, { type: e.target.value as MacroAction['type'] })
                          }
                          className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {ACTION_TYPES.map((at) => (
                            <option key={at.value} value={at.value}>
                              {at.label}
                            </option>
                          ))}
                        </select>

                        {action.type === 'escalate' && (
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Level</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={action.level ?? 2}
                              onChange={(e) =>
                                updateAction(idx, { level: parseInt(e.target.value) || 2 })
                              }
                              className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        )}

                        {action.type === 'set_status' && (
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Status</label>
                            <select
                              value={action.status || ''}
                              onChange={(e) => updateAction(idx, { status: e.target.value })}
                              className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">Select...</option>
                              {TICKET_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {action.type === 'notify_users' && (
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Users</label>
                            <div className="flex flex-wrap gap-1.5">
                              {teamMembers.map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => toggleUserId(idx, m.id)}
                                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                                    (action.user_ids || []).includes(m.id)
                                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                      : 'border-gray-300 bg-white text-slate-600 hover:border-gray-400'
                                  }`}
                                >
                                  {m.first_name} {m.last_name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {action.type === 'notify_roles' && (
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Roles</label>
                            <div className="flex flex-wrap gap-1.5">
                              {AVAILABLE_ROLES.map((role) => (
                                <button
                                  key={role}
                                  onClick={() => toggleRoleName(idx, role)}
                                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                                    (action.role_names || []).includes(role)
                                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                      : 'border-gray-300 bg-white text-slate-600 hover:border-gray-400'
                                  }`}
                                >
                                  {role.replace(/_/g, ' ')}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {form.actions.length > 1 && (
                        <button
                          onClick={() => removeAction(idx)}
                          className="mt-1 text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || form.actions.length === 0}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
