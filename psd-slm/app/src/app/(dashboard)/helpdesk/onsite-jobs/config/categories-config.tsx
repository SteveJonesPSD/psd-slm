'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { OnsiteJobCategory } from '@/lib/onsite-jobs/types'
import { createOnsiteJobCategory, updateOnsiteJobCategory } from '../actions'

interface CategoriesConfigProps {
  categories: OnsiteJobCategory[]
}

export function CategoriesConfig({ categories }: CategoriesConfigProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [colour, setColour] = useState('#6B7280')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setName('')
    setColour('#6B7280')
    setShowModal(true)
  }

  function openEdit(cat: OnsiteJobCategory) {
    setEditingId(cat.id)
    setName(cat.name)
    setColour(cat.colour || '#6B7280')
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    setError(null)

    const result = editingId
      ? await updateOnsiteJobCategory(editingId, { name, colour })
      : await createOnsiteJobCategory({ name, colour })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setShowModal(false)
    setLoading(false)
    router.refresh()
  }

  async function toggleActive(cat: OnsiteJobCategory) {
    await updateOnsiteJobCategory(cat.id, { is_active: !cat.is_active })
    router.refresh()
  }

  async function moveUp(cat: OnsiteJobCategory, index: number) {
    if (index === 0) return
    const prev = categories[index - 1]
    await Promise.all([
      updateOnsiteJobCategory(cat.id, { sort_order: prev.sort_order }),
      updateOnsiteJobCategory(prev.id, { sort_order: cat.sort_order }),
    ])
    router.refresh()
  }

  async function moveDown(cat: OnsiteJobCategory, index: number) {
    if (index >= categories.length - 1) return
    const next = categories[index + 1]
    await Promise.all([
      updateOnsiteJobCategory(cat.id, { sort_order: next.sort_order }),
      updateOnsiteJobCategory(next.id, { sort_order: cat.sort_order }),
    ])
    router.refresh()
  }

  return (
    <div>
      {/* Back link + header */}
      <Link href="/helpdesk/onsite-jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 no-underline mb-6 block">
        &larr; Onsite Jobs
      </Link>

      <div className="flex items-center justify-between mb-12">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Onsite Job Categories</h1>
        <Button size="sm" variant="primary" onClick={openAdd}>Add Category</Button>
      </div>

      {/* Categories table */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 w-20">Colour</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 w-20">Active</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 w-20">Order</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, i) => (
              <tr key={cat.id} className="border-b border-gray-50 dark:border-slate-700/50">
                <td className="px-4 py-3 text-slate-900 dark:text-slate-200 font-medium">{cat.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: cat.colour || '#6b7280' }} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(cat)}
                    className={`h-5 w-9 rounded-full transition-colors relative ${
                      cat.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      cat.is_active ? 'left-4' : 'left-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveUp(cat, i)} disabled={i === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => moveDown(cat, i)} disabled={i >= categories.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(cat)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                  No categories defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {editingId ? 'Edit Category' : 'Add Category'}
            </h2>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Colour</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={colour}
                    onChange={e => setColour(e.target.value)}
                    className="w-32 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#000000"
                  />
                  <span className="inline-block h-8 w-8 rounded border border-gray-200 dark:border-slate-600" style={{ backgroundColor: colour }} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <Button size="sm" variant="default" onClick={() => setShowModal(false)} disabled={loading}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={handleSave} disabled={loading || !name.trim()}>
                {editingId ? 'Save' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
