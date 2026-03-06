'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Article {
  id: string
  title: string
  slug: string
  body: string
  category_id: string | null
  kb_categories: Record<string, unknown> | null
  view_count: number
  updated_at: string
}

export function PortalKbList({ articles }: { articles: Article[] }) {
  const [search, setSearch] = useState('')

  const filtered = articles.filter(a => {
    if (!search) return true
    const term = search.toLowerCase()
    return a.title.toLowerCase().includes(term) || a.body.toLowerCase().includes(term)
  })

  // Group by category
  const grouped: Record<string, { name: string; articles: Article[] }> = {}
  const uncategorised: Article[] = []

  for (const article of filtered) {
    if (article.category_id && article.kb_categories) {
      const catName = (article.kb_categories as Record<string, unknown>).name as string
      if (!grouped[article.category_id]) grouped[article.category_id] = { name: catName, articles: [] }
      grouped[article.category_id].articles.push(article)
    } else {
      uncategorised.push(article)
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-slate-900">Knowledge Base</h1>
      <p className="mb-6 text-sm text-slate-500">Find answers to common questions</p>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-slate-400">No articles found</p>
          <Link href="/portal/helpdesk/new" className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-800">
            Still need help? Create a support ticket
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([catId, { name, articles: catArticles }]) => (
            <div key={catId}>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">{name}</h2>
              <div className="space-y-2">
                {catArticles.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          ))}
          {uncategorised.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">General</h2>
              <div className="space-y-2">
                {uncategorised.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ArticleCard({ article }: { article: Article }) {
  const excerpt = article.body.substring(0, 150).replace(/[#*`\n]/g, ' ').trim()

  return (
    <Link
      href={`/portal/knowledge-base/${article.slug}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 no-underline hover:shadow-sm transition-shadow"
    >
      <h3 className="text-sm font-semibold text-slate-900">{article.title}</h3>
      {article.kb_categories ? (
        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-slate-500">
          {(article.kb_categories as Record<string, unknown>).name as string}
        </span>
      ) : null}
      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{excerpt}...</p>
    </Link>
  )
}
