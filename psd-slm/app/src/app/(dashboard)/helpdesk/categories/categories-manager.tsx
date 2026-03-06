'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createCategory, updateCategory, deleteCategory } from '../actions'

interface Category {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  parent?: { id: string; name: string } | null
  is_active: boolean
  sort_order: number
}

export function CategoriesManager({ initialData }: { initialData: Category[] }) {
  const [categories, setCategories] = useState(initialData)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', parent_id: '' })

  const topLevel = categories.filter(c => !c.parent_id)
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', parent_id: '' })
    setShowModal(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ name: cat.name, description: cat.description || '', parent_id: cat.parent_id || '' })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const result = await updateCategory(editing.id, {
          name: form.name,
          description: form.description || undefined,
          parent_id: form.parent_id || undefined,
        })
        if (!result.error) {
          setCategories(prev => prev.map(c =>
            c.id === editing.id ? { ...c, name: form.name, description: form.description || null, parent_id: form.parent_id || null } : c
          ))
        }
      } else {
        const result = await createCategory({
          name: form.name,
          description: form.description || undefined,
          parent_id: form.parent_id || undefined,
        })
        if (result.data) {
          setCategories(prev => [...prev, result.data as Category])
        }
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return
    const result = await deleteCategory(id)
    if (!result.error) {
      setCategories(prev => prev.filter(c => c.id !== id))
    }
  }

  async function handleToggle(cat: Category) {
    const result = await updateCategory(cat.id, { is_active: !cat.is_active })
    if (!result.error) {
      setCategories(prev => prev.map(c =>
        c.id === cat.id ? { ...c, is_active: !c.is_active } : c
      ))
    }
  }

  return (
    <div>
      <div className="mb-8 flex justify-end">
        <Button variant="primary" onClick={openCreate}>
          Add Category
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Description</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Parent</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500">Active</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {topLevel.map(cat => (
              <>
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  indent={0}
                  onEdit={() => openEdit(cat)}
                  onDelete={() => handleDelete(cat.id)}
                  onToggle={() => handleToggle(cat)}
                />
                {getChildren(cat.id).map(child => (
                  <CategoryRow
                    key={child.id}
                    category={child}
                    indent={1}
                    onEdit={() => openEdit(child)}
                    onDelete={() => handleDelete(child.id)}
                    onToggle={() => handleToggle(child)}
                  />
                ))}
              </>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No categories yet. Click &quot;Add Category&quot; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              {editing ? 'Edit Category' : 'New Category'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Parent Category</label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">None (top level)</option>
                  {topLevel.filter(c => c.id !== editing?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  category,
  indent,
  onEdit,
  onDelete,
  onToggle,
}: {
  category: Category
  indent: number
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-4 py-3 font-medium text-slate-900" style={{ paddingLeft: `${16 + indent * 24}px` }}>
        {indent > 0 && <span className="mr-1.5 text-slate-300">└</span>}
        {category.name}
      </td>
      <td className="px-4 py-3 text-slate-500">{category.description || '—'}</td>
      <td className="px-4 py-3 text-slate-500">{category.parent?.name || '—'}</td>
      <td className="px-4 py-3 text-center">
        <button onClick={onToggle} className="text-xs">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${category.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={onEdit} className="mr-2 text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">Delete</button>
      </td>
    </tr>
  )
}
