import { getKbArticles, getKbCategories } from '../actions'
import { KbArticleList } from './kb-article-list'

export default async function KnowledgeBasePage() {
  const [articlesResult, categoriesResult] = await Promise.all([
    getKbArticles(),
    getKbCategories(),
  ])

  return (
    <KbArticleList
      initialArticles={articlesResult.data || []}
      categories={categoriesResult.data || []}
    />
  )
}
