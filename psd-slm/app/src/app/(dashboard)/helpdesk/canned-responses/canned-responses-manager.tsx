'use client'

import { useState } from 'react'
import { createCannedResponse, updateCannedResponse, deleteCannedResponse } from '../actions'

interface CannedResponseRow {
  id: string
  title: string
  body: string
  category: string | null
  is_shared: boolean
  created_by: string | null
  creator?: { id: string; first_name: string; last_name: string } | null
  created_at: string
  updated_at: string
}

export function CannedResponsesManager({ initialData }: { initialData: CannedResponseRow[] }) {
  const [responses, setResponses] = useState(initialData)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CannedResponseRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', category: '', is_shared: true })

  function openCreate() {
    setEditing(null)
    setForm({ title: '', body: '', category: '', is_shared: true })
    setShowModal(true)
  }

  function openEdit(r: CannedResponseRow) {
    setEditing(r)
    setForm({ title: r.title, body: r.body, category: r.category || '', is_shared: r.is_shared })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const result = await updateCannedResponse(editing.id, {
          title: form.title,
          body: form.body,
          category: form.category || null,
          is_shared: form.is_shared,
        })
        if (!result.error) {
          setResponses(prev => prev.map(r =>
            r.id === editing.id ? { ...r, title: form.title, body: form.body, category: form.category || null, is_shared: form.is_shared } : r
          ))
        }
      } else {
        const result = await createCannedResponse({
          title: form.title,
          body: form.body,
          category: form.category || undefined,
          is_shared: form.is_shared,
        })
        if (result.data) {
          setResponses(prev => [...prev, result.data as CannedResponseRow])
        }
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this canned response?')) return
    const result = await deleteCannedResponse(id)
    if (!result.error) {
      setResponses(prev => prev.filter(r => r.id !== id))
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Response
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Category</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Preview</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500">Shared</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Created By</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {responses.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-slate-900">{r.title}</td>
                <td className="px-4 py-3 text-slate-500">{r.category || '—'}</td>
                <td className="px-4 py-3 text-slate-500 max-w-[300px] truncate">
                  {r.body.substring(0, 80)}{r.body.length > 80 ? '...' : ''}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${r.is_shared ? 'bg-green-500' : 'bg-gray-300'}`} />
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {r.creator ? `${r.creator.first_name} ${r.creator.last_name}` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(r)} className="mr-2 text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                  <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </td>
              </tr>
            ))}
            {responses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No canned responses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              {editing ? 'Edit Canned Response' : 'New Canned Response'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Greeting, Troubleshooting"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Body</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm({ ...form, body: e.target.value })}
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_shared"
                  checked={form.is_shared}
                  onChange={e => setForm({ ...form, is_shared: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_shared" className="text-sm text-slate-700">Shared with all agents</label>
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
                disabled={saving || !form.title.trim() || !form.body.trim()}
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
