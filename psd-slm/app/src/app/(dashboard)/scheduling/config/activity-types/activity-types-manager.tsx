'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createActivityType, updateActivityType, deleteActivityType } from '../../actions'
import { Button } from '@/components/ui/button'

const COLOR_PALETTE = [
  { label: 'Slate', color: '#6b7280', background: '#f3f4f6' },
  { label: 'Blue', color: '#2563eb', background: '#eff6ff' },
  { label: 'Green', color: '#059669', background: '#ecfdf5' },
  { label: 'Amber', color: '#d97706', background: '#fffbeb' },
  { label: 'Red', color: '#dc2626', background: '#fef2f2' },
  { label: 'Purple', color: '#7c3aed', background: '#f5f3ff' },
  { label: 'Teal', color: '#0d9488', background: '#f0fdfa' },
  { label: 'Pink', color: '#db2777', background: '#fdf2f8' },
  { label: 'Indigo', color: '#6366f1', background: '#eef2ff' },
  { label: 'Orange', color: '#ea580c', background: '#fff7ed' },
]

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: 'Half day', value: 240 },
  { label: 'Full day', value: 480 },
]

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ActivityTypesManager({ initialTypes }: { initialTypes: any[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [colorIdx, setColorIdx] = useState(0)
  const [duration, setDuration] = useState(60)
  const [isActive, setIsActive] = useState(true)

  function openCreate() {
    setEditing(null)
    setName('')
    setSlug('')
    setColorIdx(0)
    setDuration(60)
    setIsActive(true)
    setError(null)
    setShowModal(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function openEdit(at: any) {
    setEditing(at)
    setName(at.name)
    setSlug(at.slug)
    const idx = COLOR_PALETTE.findIndex(c => c.color === at.color)
    setColorIdx(idx >= 0 ? idx : 0)
    setDuration(at.default_duration_minutes)
    setIsActive(at.is_active)
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
      is_active: isActive,
    }

    const result = editing
      ? await updateActivityType(editing.id, payload)
      : await createActivityType(payload)

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setShowModal(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this activity type? This cannot be undone.')) return
    setDeleting(id)
    const result = await deleteActivityType(id)
    setDeleting(null)
    if (result.error) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  async function handleToggleActive(at: { id: string; is_active: boolean }) {
    await updateActivityType(at.id, { is_active: !at.is_active })
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Activity Types</h3>
        <Button
          onClick={openCreate}
          variant="primary"
          size="sm"
        >
          + New Activity Type
        </Button>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Activities are non-job schedule entries like holidays, meetings, and training. They appear on the dispatch calendar and week view.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[600px] w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-500">Colour</th>
              <th className="px-4 py-3 font-medium text-slate-500">Name</th>
              <th className="px-4 py-3 font-medium text-slate-500">Duration</th>
              <th className="px-4 py-3 font-medium text-slate-500">Active</th>
              <th className="px-4 py-3 font-medium text-slate-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialTypes.map(at => (
              <tr key={at.id} className={!at.is_active ? 'opacity-50' : ''}>
                <td className="px-4 py-3">
                  <span
                    className="inline-block w-6 h-6 rounded-full border border-slate-200"
                    style={{ backgroundColor: at.color }}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{at.name}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {at.default_duration_minutes >= 60
                    ? `${Math.floor(at.default_duration_minutes / 60)}h${at.default_duration_minutes % 60 > 0 ? ` ${at.default_duration_minutes % 60}m` : ''}`
                    : `${at.default_duration_minutes}m`
                  }
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(at)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      at.is_active ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      at.is_active ? 'translate-x-4.5' : 'translate-x-1'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(at)}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(at.id)}
                      disabled={deleting === at.id}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deleting === at.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {initialTypes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No activity types configured. Create one to get started.
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
                {editing ? 'Edit Activity Type' : 'New Activity Type'}
              </h3>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <div className="space-y-4">
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
                    placeholder="e.g. Holiday, Customer Meeting, Training"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. holiday"
                  />
                </div>

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
                      {name || 'Activity'}
                    </span>
                  </div>
                </div>

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
                <Button
                  onClick={handleSave}
                  variant="primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
