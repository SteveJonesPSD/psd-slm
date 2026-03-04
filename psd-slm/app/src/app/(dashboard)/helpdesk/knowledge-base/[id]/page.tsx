import { notFound } from 'next/navigation'
import { getKbArticle, getKbCategories } from '../../actions'
import { KbArticleEditor } from '../kb-article-editor'

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [articleResult, categoriesResult] = await Promise.all([
    getKbArticle(id),
    getKbCategories(),
  ])

  if (articleResult.error || !articleResult.data) {
    notFound()
  }

  return (
    <KbArticleEditor
      article={articleResult.data}
      categories={categoriesResult.data || []}
    />
  )
}
