import { notFound } from 'next/navigation'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalKbArticle } from '@/lib/portal/kb-actions'
import { PortalKbArticleView } from './portal-kb-article-view'

export default async function PortalKbArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await requirePortalSession()
  const article = await getPortalKbArticle(slug, ctx)

  if (!article) notFound()

  return <PortalKbArticleView article={article} />
}
