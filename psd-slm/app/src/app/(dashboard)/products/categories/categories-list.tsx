'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { ProductCategory } from '@/types/database'
import { createCategory, updateCategory, deleteCategory, reorderCategories, seedCategories } from './actions'

interface CategoriesListProps {
  categories: (ProductCategory & { product_count: number })[]
}

export function CategoriesList({ categories: initial }: CategoriesListProps) {
  const router = useRouter()
  const [categories, setCategories] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const handleStartEdit = (cat: ProductCategory & { product_count: number }) => {
    setEditingId(cat.id)
    setEditName(cat.name)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return
    setSaving(true)
    setError('')
    const cat = categories.find((c) => c.id === id)
    const fd = new FormData()
    fd.set('name', editName.trim())
    fd.set('requires_serial', String(cat?.requires_serial ?? false))
    const result = await updateCategory(id, fd)
    if (result.error) setError(result.error)
    else {
      setEditingId(null)
      router.refresh()
    }
    setSaving(false)
  }

  const handleToggleSerial = async (cat: ProductCategory & { product_count: number }) => {
    setSaving(true)
    setError('')
    const fd = new FormData()
    fd.set('name', cat.name)
    fd.set('requires_serial', String(!cat.requires_serial))
    const result = await updateCategory(cat.id, fd)
    if (result.error) setError(result.error)
    else {
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, requires_serial: !c.requires_serial } : c))
      )
    }
    setSaving(false)
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    const fd = new FormData()
    fd.set('name', newName.trim())
    fd.set('requires_serial', 'false')
    const result = await createCategory(fd)
    if (result.error) setError(result.error)
    else {
      setNewName('')
      setShowAdd(false)
      router.refresh()
    }
    setSaving(false)
  }

  const handleDelete = async (cat: ProductCategory & { product_count: number }) => {
    if (cat.product_count > 0) {
      setError(`This category contains ${cat.product_count} product${cat.product_count === 1 ? '' : 's'}. Move them to another category first.`)
      return
    }
    if (!confirm(`Delete "${cat.name}"?`)) return
    setSaving(true)
    setError('')
    const result = await deleteCategory(cat.id)
    if (result.error) setError(result.error)
    else router.refresh()
    setSaving(false)
  }

  const handleDragStart = (index: number) => {
    dragItem.current = index
  }

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index
  }

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return

    const reordered = [...categories]
    const [removed] = reordered.splice(dragItem.current, 1)
    reordered.splice(dragOverItem.current, 0, removed)
    setCategories(reordered)
    dragItem.current = null
    dragOverItem.current = null

    await reorderCategories(reordered.map((c) => c.id))
  }

  const handleSeed = async () => {
    setSaving(true)
    setError('')
    const result = await seedCategories()
    if (result.error) setError(result.error)
    else router.refresh()
    setSaving(false)
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400 mb-4">No categories yet.</p>
          <Button variant="primary" onClick={handleSeed} disabled={saving}>
            {saving ? 'Seeding...' : 'Seed Default Categories'}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`flex items-center gap-3 px-4 py-3 ${
                index < categories.length - 1 ? 'border-b border-slate-100' : ''
              } hover:bg-slate-50 transition-colors`}
            >
              {/* Drag handle */}
              <span className="cursor-grab text-slate-300 hover:text-slate-500 select-none" title="Drag to reorder">
                ⠿
              </span>

              {/* Category name */}
              {editingId === cat.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(cat.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onBlur={() => handleSaveEdit(cat.id)}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
                  disabled={saving}
                />
              ) : (
                <span
                  className="flex-1 text-sm text-slate-700 font-medium cursor-pointer hover:text-slate-900"
                  onClick={() => handleStartEdit(cat)}
                >
                  {cat.name}
                </span>
              )}

              {/* Requires serial toggle */}
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={cat.requires_serial}
                  onChange={() => handleToggleSerial(cat)}
                  className="rounded border-slate-300"
                  disabled={saving}
                />
                Requires Serial
              </label>

              {/* Product count */}
              <span className="text-xs text-slate-400 whitespace-nowrap min-w-[60px] text-right">
                {cat.product_count} product{cat.product_count === 1 ? '' : 's'}
              </span>

              {/* Delete */}
              <button
                onClick={() => handleDelete(cat)}
                className="text-slate-300 hover:text-red-500 transition-colors text-sm"
                title="Delete category"
                disabled={saving}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add new row */}
          {showAdd ? (
            <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50">
              <span className="text-slate-300">⠿</span>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') { setShowAdd(false); setNewName('') }
                }}
                placeholder="Category name..."
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
                disabled={saving}
              />
              <Button size="sm" variant="primary" onClick={handleAdd} disabled={!newName.trim() || saving}>
                {saving ? 'Saving...' : 'Add'}
              </Button>
              <Button size="sm" onClick={() => { setShowAdd(false); setNewName('') }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                + Add Category
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
