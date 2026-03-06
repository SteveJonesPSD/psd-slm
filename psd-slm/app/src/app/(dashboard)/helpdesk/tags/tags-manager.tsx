'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { TicketTag } from '@/types/database'
import { createTag, updateTag, deleteTag, updateTagAiAssignable } from '../actions'

const PRESET_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#059669',
  '#0891b2', '#2563eb', '#7c3aed', '#9333ea', '#b91c1c',
  '#64748b', '#6b7280',
]

interface TagsManagerProps {
  initialData: TicketTag[]
}

export function TagsManager({ initialData }: TagsManagerProps) {
  const [tags, setTags] = useState(initialData)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TicketTag | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', color: '#6b7280', is_ai_assignable: false })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', color: '#6b7280', is_ai_assignable: false })
    setShowModal(true)
  }

  function openEdit(tag: TicketTag) {
    setEditing(tag)
    setForm({ name: tag.name, color: tag.color, is_ai_assignable: tag.is_ai_assignable })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const result = await updateTag(editing.id, {
          name: form.name,
          color: form.color,
          is_ai_assignable: form.is_ai_assignable,
        })
        if (!result.error) {
          setTags(tags.map((t) => (t.id === editing.id ? { ...t, ...form } : t)))
          setShowModal(false)
        }
      } else {
        const result = await createTag(form)
        if (result.data) {
          setTags([...tags, result.data])
          setShowModal(false)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this tag?')) return
    const result = await deleteTag(id)
    if (!result.error) {
      setTags(tags.filter((t) => t.id !== id))
    }
  }

  async function handleToggleAi(tag: TicketTag) {
    const newVal = !tag.is_ai_assignable
    const result = await updateTagAiAssignable(tag.id, newVal)
    if (!result.error) {
      setTags(tags.map((t) => (t.id === tag.id ? { ...t, is_ai_assignable: newVal } : t)))
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Tags</h1>
          <p className="text-sm text-slate-500">Manage ticket tags. Tags marked as AI-assignable will be used by the auto-triage system.</p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          New Tag
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Color</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">AI Assignable</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Active</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No tags yet.
                </td>
              </tr>
            ) : (
              tags.map((tag) => (
                <tr key={tag.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <span className="flex items-center gap-2">
                      {tag.name}
                      {tag.is_ai_assignable && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                          AI
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block h-5 w-5 rounded-full border border-gray-200"
                      style={{ backgroundColor: tag.color }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleAi(tag)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        tag.is_ai_assignable ? 'bg-violet-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          tag.is_ai_assignable ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        tag.is_active ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(tag)}
                      className="mr-3 text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editing ? 'Edit Tag' : 'New Tag'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. System Down"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${
                        form.color === c ? 'border-slate-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="mt-2 w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="#6b7280"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ai-assignable"
                  checked={form.is_ai_assignable}
                  onChange={(e) => setForm({ ...form, is_ai_assignable: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="ai-assignable" className="text-sm text-slate-700">
                  AI Assignable — allow auto-triage to assign this tag
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? 'Saving...' : editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
