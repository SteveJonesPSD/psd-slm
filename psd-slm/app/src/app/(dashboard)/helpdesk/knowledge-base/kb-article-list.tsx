'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, KB_STATUS_CONFIG } from '@/components/ui/badge'
import { deleteKbArticle, createKbCategory, updateKbCategory, deleteKbCategory } from '../actions'

interface Article {
  id: string
  title: string
  slug: string
  status: string
  is_public: boolean
  is_internal: boolean
  view_count: number
  updated_at: string
  category: { id: string; name: string } | null
  author: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
}

interface Category {
  id: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  is_public: boolean
}

export function KbArticleList({ initialArticles, categories }: { initialArticles: Article[]; categories: Category[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showCatModal, setShowCatModal] = useState(false)
  const [catList, setCatList] = useState(categories)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [catForm, setCatForm] = useState({ name: '', description: '', is_public: true })
  const [savingCat, setSavingCat] = useState(false)

  const filtered = initialArticles.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false
    if (categoryFilter && a.category?.id !== categoryFilter) return false
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function handleDelete(id: string) {
    if (!confirm('Delete this article?')) return
    await deleteKbArticle(id)
    router.refresh()
  }

  function openCatCreate() {
    setEditingCat(null)
    setCatForm({ name: '', description: '', is_public: true })
    setShowCatModal(true)
  }

  function openCatEdit(cat: Category) {
    setEditingCat(cat)
    setCatForm({ name: cat.name, description: cat.description || '', is_public: cat.is_public ?? true })
    setShowCatModal(true)
  }

  async function handleCatSave() {
    setSavingCat(true)
    try {
      if (editingCat) {
        const result = await updateKbCategory(editingCat.id, {
          name: catForm.name,
          description: catForm.description || undefined,
          is_public: catForm.is_public,
        })
        if (!result.error) {
          setCatList(prev => prev.map(c =>
            c.id === editingCat.id ? { ...c, name: catForm.name, description: catForm.description || null, is_public: catForm.is_public } : c
          ))
        }
      } else {
        const result = await createKbCategory({
          name: catForm.name,
          description: catForm.description || undefined,
          is_public: catForm.is_public,
        })
        if (result.data) {
          setCatList(prev => [...prev, result.data as Category])
        }
      }
      setShowCatModal(false)
    } finally {
      setSavingCat(false)
    }
  }

  async function handleCatDelete(id: string) {
    if (!confirm('Delete this category?')) return
    const result = await deleteKbCategory(id)
    if (!result.error) {
      setCatList(prev => prev.filter(c => c.id !== id))
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Knowledge Base</h2>
          <p className="text-sm text-slate-500">Manage articles and categories</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCatCreate}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
          >
            Manage Categories
          </button>
          <Link
            href="/helpdesk/knowledge-base/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
          >
            + New Article
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {catList.filter(c => c.is_active).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Articles Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Category</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500">Public</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500">Internal</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Author</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Views</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Updated</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(article => {
              const statusCfg = KB_STATUS_CONFIG[article.status]
              return (
                <tr key={article.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/helpdesk/knowledge-base/${article.id}`} className="font-medium text-slate-900 hover:text-indigo-600 no-underline">
                      {article.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{article.category?.name || '—'}</td>
                  <td className="px-4 py-3">
                    {statusCfg ? <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} /> : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {article.is_public ? (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                    ) : (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {article.is_internal ? (
                      <Badge label="Internal" color="#d97706" bg="#fffbeb" />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {article.author ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: article.author.color || '#6b7280' }}
                        >
                          {article.author.initials || `${article.author.first_name[0]}${article.author.last_name[0]}`}
                        </div>
                        <span className="text-slate-600">{article.author.first_name}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{article.view_count}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(article.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/helpdesk/knowledge-base/${article.id}`} className="mr-2 text-xs text-indigo-600 hover:text-indigo-800 no-underline">
                      Edit
                    </Link>
                    <button onClick={() => handleDelete(article.id)} className="text-xs text-red-500 hover:text-red-700">
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  No articles found. Click &quot;+ New Article&quot; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Category Management Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              {editingCat ? 'Edit Category' : 'KB Categories'}
            </h3>

            {!editingCat && (
              <div className="mb-4 max-h-60 overflow-y-auto">
                {catList.length === 0 ? (
                  <p className="text-sm text-slate-400">No categories yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-2 text-left font-medium text-slate-500">Name</th>
                        <th className="pb-2 text-center font-medium text-slate-500">Public</th>
                        <th className="pb-2 text-center font-medium text-slate-500">Active</th>
                        <th className="pb-2 text-right font-medium text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catList.map(c => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-2 text-slate-900">{c.name}</td>
                          <td className="py-2 text-center">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.is_public ? 'bg-green-500' : 'bg-gray-300'}`} />
                          </td>
                          <td className="py-2 text-center">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                          </td>
                          <td className="py-2 text-right">
                            <button onClick={() => openCatEdit(c)} className="mr-2 text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                            <button onClick={() => handleCatDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {editingCat ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                  <input
                    type="text"
                    value={catForm.name}
                    onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    value={catForm.description}
                    onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="catPublic"
                    checked={catForm.is_public}
                    onChange={e => setCatForm({ ...catForm, is_public: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="catPublic" className="text-sm text-slate-700">Visible in customer portal</label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingCat(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCatSave}
                    disabled={savingCat || !catForm.name.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingCat ? 'Saving...' : 'Update'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-slate-700">Add New Category</h4>
                <div>
                  <input
                    type="text"
                    placeholder="Category name"
                    value={catForm.name}
                    onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newCatPublic"
                    checked={catForm.is_public}
                    onChange={e => setCatForm({ ...catForm, is_public: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="newCatPublic" className="text-sm text-slate-700">Visible in customer portal</label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCatModal(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleCatSave}
                    disabled={savingCat || !catForm.name.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingCat ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
