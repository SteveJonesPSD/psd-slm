import { getKbCategories } from '../../actions'
import { KbArticleEditor } from '../kb-article-editor'

export default async function NewArticlePage() {
  const { data: categories } = await getKbCategories()

  return <KbArticleEditor categories={categories || []} />
}
