'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/ui/form-fields'
import { createJobType, updateJobType, deleteJobType } from '../../actions'

const COLOR_PALETTE = [
  { label: 'Green', color: '#059669', background: '#ecfdf5' },
  { label: 'Blue', color: '#2563eb', background: '#eff6ff' },
  { label: 'Red', color: '#dc2626', background: '#fef2f2' },
  { label: 'Amber', color: '#d97706', background: '#fffbeb' },
  { label: 'Purple', color: '#7c3aed', background: '#f5f3ff' },
  { label: 'Slate', color: '#6b7280', background: '#f3f4f6' },
  { label: 'Indigo', color: '#6366f1', background: '#eef2ff' },
  { label: 'Teal', color: '#0d9488', background: '#f0fdfa' },
  { label: 'Pink', color: '#db2777', background: '#fdf2f8' },
  { label: 'Orange', color: '#ea580c', background: '#fff7ed' },
]

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '4 hours', value: 240 },
  { label: 'Half day', value: 300 },
  { label: 'Full day', value: 480 },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  initialTypes: any[]
  templates: { id: string; name: string; is_active: boolean; item_count: number }[]
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function JobTypesManager({ initialTypes, templates }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [colorIdx, setColorIdx] = useState(0)
  const [duration, setDuration] = useState(60)
  const [templateId, setTemplateId] = useState<string>('')
  const [isActive, setIsActive] = useState(true)

  function openCreate() {
    setEditing(null)
    setName('')
    setSlug('')
    setColorIdx(0)
    setDuration(60)
    setTemplateId('')
    setIsActive(true)
    setError(null)
    setShowModal(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function openEdit(jt: any) {
    setEditing(jt)
    setName(jt.name)
    setSlug(jt.slug)
    const idx = COLOR_PALETTE.findIndex(c => c.color === jt.color)
    setColorIdx(idx >= 0 ? idx : 0)
    setDuration(jt.default_duration_minutes)
    setTemplateId(jt.task_template_id || '')
    setIsActive(jt.is_active)
    setError(null)
    setShowModal(true)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    const finalSlug = slug.trim() || slugify(name)
    if (!finalSlug) { setError('Slug is required'); return }

    setSaving(true)
    setError(null)

    const palette = COLOR_PALETTE[colorIdx]
    const payload = {
      name: name.trim(),
      slug: finalSlug,
      color: palette.color,
      background: palette.background,
      default_duration_minutes: duration,
      task_template_id: templateId || null,
      is_active: isActive,
    }

    const result = editing
      ? await updateJobType(editing.id, payload)
      : await createJobType(payload)

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setShowModal(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this job type? This cannot be undone.')) return
    setDeleting(id)
    const result = await deleteJobType(id)
    setDeleting(null)
    if (result.error) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  async function handleToggleActive(jt: { id: string; is_active: boolean }) {
    await updateJobType(jt.id, { is_active: !jt.is_active })
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Job Types</h3>
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Job Type
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[700px] w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-500">Colour</th>
              <th className="px-4 py-3 font-medium text-slate-500">Name</th>
              <th className="px-4 py-3 font-medium text-slate-500">Slug</th>
              <th className="px-4 py-3 font-medium text-slate-500">Duration</th>
              <th className="px-4 py-3 font-medium text-slate-500">Task Template</th>
              <th className="px-4 py-3 font-medium text-slate-500">Active</th>
              <th className="px-4 py-3 font-medium text-slate-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialTypes.map(jt => (
              <tr key={jt.id} className={!jt.is_active ? 'opacity-50' : ''}>
                <td className="px-4 py-3">
                  <span
                    className="inline-block w-6 h-6 rounded-full border border-slate-200"
                    style={{ backgroundColor: jt.color }}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{jt.name}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{jt.slug}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {jt.default_duration_minutes >= 60
                    ? `${Math.floor(jt.default_duration_minutes / 60)}h${jt.default_duration_minutes % 60 > 0 ? ` ${jt.default_duration_minutes % 60}m` : ''}`
                    : `${jt.default_duration_minutes}m`
                  }
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {jt.task_template?.name || <span className="text-slate-400">None</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(jt)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      jt.is_active ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      jt.is_active ? 'translate-x-4.5' : 'translate-x-1'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(jt)}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(jt.id)}
                      disabled={deleting === jt.id}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deleting === jt.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {initialTypes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No job types configured. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {editing ? 'Edit Job Type' : 'New Job Type'}
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
                    onChange={e => {
                      setName(e.target.value)
                      if (!editing) setSlug(slugify(e.target.value))
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. Installation"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. installation"
                  />
                </div>

                {/* Colour */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Colour</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setColorIdx(i)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          colorIdx === i ? 'border-slate-900 scale-110' : 'border-slate-200'
                        }`}
                        style={{ backgroundColor: c.color }}
                        title={c.label}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Preview:</span>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        color: COLOR_PALETTE[colorIdx].color,
                        backgroundColor: COLOR_PALETTE[colorIdx].background,
                      }}
                    >
                      {name || 'Job Type'}
                    </span>
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Default Duration</label>
                  <select
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {DURATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Task Template */}
                <SearchableSelect
                  label="Task Template"
                  value={templateId}
                  options={templates.filter(t => t.is_active).map(t => ({ value: t.id, label: `${t.name} (${t.item_count} tasks)` }))}
                  placeholder="None"
                  onChange={setTemplateId}
                />

                {/* Active */}
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
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
