'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTaskTemplate, updateTaskTemplate, deleteTaskTemplate, getTaskTemplate } from '../../actions'

type ResponseType = 'yes_no' | 'text' | 'date'

const RESPONSE_TYPE_OPTIONS: { value: ResponseType; label: string }[] = [
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'text', label: 'Free Text' },
  { value: 'date', label: 'Date' },
]

interface TemplateItem {
  id?: string
  description: string
  is_required: boolean
  response_type: ResponseType
  sort_order: number
}

interface TemplateSummary {
  id: string
  name: string
  description: string | null
  is_active: boolean
  item_count: number
}

export function TaskTemplatesManager({ initialTemplates }: { initialTemplates: TemplateSummary[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<TemplateItem[]>([])
  const [isActive, setIsActive] = useState(true)

  function openCreate() {
    setEditingId(null)
    setName('')
    setDescription('')
    setItems([{ description: '', is_required: true, response_type: 'yes_no', sort_order: 0 }])
    setIsActive(true)
    setError(null)
    setShowModal(true)
  }

  async function openEdit(id: string) {
    setLoading(true)
    setError(null)
    const result = await getTaskTemplate(id)
    setLoading(false)

    if (result.error || !result.data) {
      alert(result.error || 'Failed to load template')
      return
    }

    const t = result.data
    setEditingId(id)
    setName(t.name)
    setDescription(t.description || '')
    setItems(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t.items || []).map((item: any, i: number) => ({
        id: item.id,
        description: item.description,
        is_required: item.is_required,
        response_type: (item.response_type || 'yes_no') as ResponseType,
        sort_order: i,
      }))
    )
    setIsActive(t.is_active)
    setShowModal(true)
  }

  function addItem() {
    setItems([...items, { description: '', is_required: true, response_type: 'yes_no', sort_order: items.length }])
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sort_order: i })))
  }

  function updateItem(index: number, field: 'description' | 'is_required' | 'response_type', value: string | boolean) {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === items.length - 1) return
    const newItems = [...items]
    const swap = direction === 'up' ? index - 1 : index + 1
    ;[newItems[index], newItems[swap]] = [newItems[swap], newItems[index]]
    setItems(newItems.map((item, i) => ({ ...item, sort_order: i })))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }

    const validItems = items.filter(item => item.description.trim())
    if (validItems.length === 0) { setError('Add at least one task'); return }

    setSaving(true)
    setError(null)

    const itemsPayload = validItems.map((item, i) => ({
      description: item.description.trim(),
      is_required: item.is_required,
      response_type: item.response_type,
      sort_order: i,
    }))

    const result = editingId
      ? await updateTaskTemplate(editingId, {
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
          items: itemsPayload,
        })
      : await createTaskTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          items: itemsPayload,
        })

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setShowModal(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    setDeleting(id)
    const result = await deleteTaskTemplate(id)
    setDeleting(null)
    if (result.error) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    await updateTaskTemplate(id, { is_active: !currentActive })
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Task Templates</h3>
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Template
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[600px] w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-500">Name</th>
              <th className="px-4 py-3 font-medium text-slate-500">Description</th>
              <th className="px-4 py-3 font-medium text-slate-500">Tasks</th>
              <th className="px-4 py-3 font-medium text-slate-500">Active</th>
              <th className="px-4 py-3 font-medium text-slate-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialTemplates.map(t => (
              <tr key={t.id} className={!t.is_active ? 'opacity-50' : ''}>
                <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                <td className="px-4 py-3 text-slate-600 max-w-[300px] truncate">{t.description || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{t.item_count}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(t.id, t.is_active)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      t.is_active ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      t.is_active ? 'translate-x-4.5' : 'translate-x-1'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(t.id)}
                      disabled={loading}
                      className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deleting === t.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {initialTemplates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No task templates configured. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {editingId ? 'Edit Task Template' : 'New Task Template'}
              </h3>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. Server Maintenance Checklist"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="Optional description"
                  />
                </div>

                {/* Active toggle (only for editing) */}
                {editingId && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        isActive ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        isActive ? 'translate-x-4.5' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className="text-sm text-slate-700">Active</span>
                  </div>
                )}

                {/* Tasks */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tasks</label>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 group">
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveItem(index, 'up')}
                            disabled={index === 0}
                            className="text-slate-400 hover:text-slate-600 disabled:opacity-25 text-xs leading-none"
                          >
                            &#9650;
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, 'down')}
                            disabled={index === items.length - 1}
                            className="text-slate-400 hover:text-slate-600 disabled:opacity-25 text-xs leading-none"
                          >
                            &#9660;
                          </button>
                        </div>

                        {/* Description input */}
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(index, 'description', e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          placeholder={`Task ${index + 1}`}
                        />

                        {/* Response type */}
                        <select
                          value={item.response_type}
                          onChange={e => updateItem(index, 'response_type', e.target.value)}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                          {RESPONSE_TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>

                        {/* Required checkbox */}
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={item.is_required}
                            onChange={e => updateItem(index, 'is_required', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Required
                        </label>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove task"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Add Task
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
