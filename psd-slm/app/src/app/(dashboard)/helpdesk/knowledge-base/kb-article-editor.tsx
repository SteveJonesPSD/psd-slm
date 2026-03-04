'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SearchableSelect } from '@/components/ui/form-fields'
import { createKbArticle, updateKbArticle, deleteKbArticle } from '../actions'

interface Article {
  id: string
  title: string
  slug: string
  body: string
  body_html: string | null
  status: string
  is_public: boolean
  is_internal: boolean
  view_count: number
  category_id: string | null
  category: { id: string; name: string } | null
  author: { id: string; first_name: string; last_name: string } | null
  created_at: string
  updated_at: string
  published_at: string | null
  totalRatings: number
  helpfulCount: number
}

interface Category {
  id: string
  name: string
  is_active: boolean
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function KbArticleEditor({ article, categories }: { article?: Article; categories: Category[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: article?.title || '',
    slug: article?.slug || '',
    body: article?.body || '',
    category_id: article?.category_id || '',
    status: article?.status || 'draft',
    is_public: article?.is_public ?? true,
    is_internal: article?.is_internal ?? false,
  })
  const [autoSlug, setAutoSlug] = useState(!article)

  function handleTitleChange(title: string) {
    setForm(prev => ({
      ...prev,
      title,
      slug: autoSlug ? slugify(title) : prev.slug,
    }))
  }

  function handleSlugChange(slug: string) {
    setAutoSlug(false)
    setForm(prev => ({ ...prev, slug }))
  }

  async function handleSave(targetStatus?: string) {
    setSaving(true)
    try {
      const fields = {
        title: form.title,
        slug: form.slug,
        body: form.body,
        category_id: form.category_id || undefined,
        status: targetStatus || form.status,
        is_public: form.is_public,
        is_internal: form.is_internal,
      }

      if (article) {
        const result = await updateKbArticle(article.id, fields)
        if (result.error) {
          alert(result.error)
          return
        }
        router.refresh()
      } else {
        const result = await createKbArticle(fields)
        if (result.error) {
          alert(result.error)
          return
        }
        if (result.data) {
          router.push(`/helpdesk/knowledge-base/${result.data.id}`)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this article permanently?')) return
    await deleteKbArticle(article!.id)
    router.push('/helpdesk/knowledge-base')
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/helpdesk/knowledge-base" className="text-sm text-slate-400 hover:text-slate-600 no-underline">
            Knowledge Base
          </Link>
          <span className="text-slate-300">/</span>
          <h2 className="text-xl font-bold text-slate-900">
            {article ? 'Edit Article' : 'New Article'}
          </h2>
        </div>
        <div className="flex gap-2">
          {article && (
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => handleSave('draft')}
            disabled={saving || !form.title.trim() || !form.slug.trim()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Save Draft
          </button>
          {form.status !== 'published' && (
            <button
              onClick={() => handleSave('published')}
              disabled={saving || !form.title.trim() || !form.slug.trim() || !form.body.trim()}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Publish
            </button>
          )}
          {form.status === 'published' && (
            <>
              <button
                onClick={() => handleSave()}
                disabled={saving || !form.title.trim() || !form.slug.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => handleSave('archived')}
                disabled={saving}
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
              >
                Archive
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor Layout */}
      <div className="flex gap-6">
        {/* Main Editor */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Article title"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">/portal/knowledge-base/</span>
              <input
                type="text"
                value={form.slug}
                onChange={e => handleSlugChange(e.target.value)}
                placeholder="article-slug"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Body (Markdown)</label>
            <textarea
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              rows={20}
              placeholder="Write your article content here using Markdown formatting...&#10;&#10;## Heading&#10;&#10;Paragraph text with **bold** and *italic*.&#10;&#10;- Bullet point&#10;- Another point&#10;&#10;```&#10;code block&#10;```"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-[280px] shrink-0 space-y-4">
          {/* Settings */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Settings</h4>

            <SearchableSelect
              label="Category"
              value={form.category_id}
              options={categories.filter(c => c.is_active).map(c => ({ value: c.id, label: c.name }))}
              placeholder="Search categories..."
              onChange={val => setForm({ ...form, category_id: val })}
            />

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={form.is_public}
                  onChange={e => setForm({ ...form, is_public: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isPublic" className="text-xs text-slate-600">
                  Visible in customer portal
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isInternal"
                  checked={form.is_internal}
                  onChange={e => setForm({ ...form, is_internal: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isInternal" className="text-xs text-slate-600">
                  Internal only (staff reference)
                </label>
              </div>
            </div>
          </div>

          {/* Stats (edit only) */}
          {article && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stats</h4>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Views</span>
                <span className="text-slate-700 font-medium">{article.view_count}</span>
              </div>
              {article.totalRatings > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Helpful</span>
                  <span className="text-slate-700 font-medium">
                    {Math.round((article.helpfulCount / article.totalRatings) * 100)}% ({article.totalRatings} ratings)
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Author</span>
                <span className="text-slate-700">{article.author ? `${article.author.first_name} ${article.author.last_name}` : '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Created</span>
                <span className="text-slate-700">{new Date(article.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Updated</span>
                <span className="text-slate-700">{new Date(article.updated_at).toLocaleDateString('en-GB')}</span>
              </div>
              {article.published_at ? (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Published</span>
                  <span className="text-slate-700">{new Date(article.published_at).toLocaleDateString('en-GB')}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
