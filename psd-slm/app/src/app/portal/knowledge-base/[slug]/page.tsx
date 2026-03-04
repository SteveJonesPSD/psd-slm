import { notFound } from 'next/navigation'
import { requirePortalAuth } from '@/lib/portal/auth'
import { getPortalKbArticle } from '@/lib/portal/actions'
import { PortalKbArticleView } from './portal-kb-article-view'

export default async function PortalKbArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requirePortalAuth()
  const article = await getPortalKbArticle(slug)

  if (!article) notFound()

  return <PortalKbArticleView article={article} />
}
