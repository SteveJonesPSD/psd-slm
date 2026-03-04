'use client'

import { useState } from 'react'
import Link from 'next/link'
import { rateKbArticle } from '@/lib/portal/actions'

interface Article {
  id: string
  title: string
  slug: string
  body: string
  body_html: string | null
  kb_categories: { name: string } | null
  view_count: number
  totalRatings: number
  helpfulCount: number
  myRating: { id: string; is_helpful: boolean } | null
}

export function PortalKbArticleView({ article }: { article: Article }) {
  const [rated, setRated] = useState(article.myRating?.is_helpful ?? null)
  const [totalRatings, setTotalRatings] = useState(article.totalRatings)
  const [helpfulCount, setHelpfulCount] = useState(article.helpfulCount)

  async function handleRate(isHelpful: boolean) {
    // Optimistic update
    if (rated === null) {
      setTotalRatings(prev => prev + 1)
      if (isHelpful) setHelpfulCount(prev => prev + 1)
    } else if (rated !== isHelpful) {
      if (isHelpful) setHelpfulCount(prev => prev + 1)
      else setHelpfulCount(prev => prev - 1)
    }
    setRated(isHelpful)
    await rateKbArticle(article.id, isHelpful)
  }

  // Simple markdown-to-HTML rendering (basic)
  function renderBody() {
    if (article.body_html) {
      return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: article.body_html }} />
    }

    // Basic markdown rendering
    const html = article.body
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-xs">$1</code>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
      .replace(/\n\n/g, '</p><p class="mt-3">')
      .replace(/\n/g, '<br/>')

    return (
      <div
        className="prose prose-sm max-w-none text-slate-700"
        dangerouslySetInnerHTML={{ __html: `<p class="mt-3">${html}</p>` }}
      />
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/portal/knowledge-base" className="text-slate-400 hover:text-slate-600 no-underline">
          Knowledge Base
        </Link>
        {article.kb_categories ? (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">{(article.kb_categories as Record<string, unknown>).name as string}</span>
          </>
        ) : null}
      </div>

      {/* Article */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">{article.title}</h1>

        {renderBody()}
      </div>

      {/* Rating */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="mb-3 text-sm font-medium text-slate-700">Was this article helpful?</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => handleRate(true)}
            className={`rounded-lg border px-6 py-2 text-sm font-medium transition-colors ${
              rated === true
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-300 text-slate-600 hover:bg-gray-50'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => handleRate(false)}
            className={`rounded-lg border px-6 py-2 text-sm font-medium transition-colors ${
              rated === false
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-300 text-slate-600 hover:bg-gray-50'
            }`}
          >
            No
          </button>
        </div>
        {totalRatings > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {helpfulCount} of {totalRatings} people found this helpful
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-4 text-center">
        <Link
          href="/portal/tickets/new"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Still need help? Contact support
        </Link>
      </div>
    </div>
  )
}
