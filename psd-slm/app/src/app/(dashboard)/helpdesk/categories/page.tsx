import { PageHeader } from '@/components/ui/page-header'
import { getCategories } from '../actions'
import { CategoriesManager } from './categories-manager'

export default async function CategoriesPage() {
  const result = await getCategories()
  const categories = result.data || []

  return (
    <div>
      <PageHeader
        title="Ticket Categories"
        subtitle={`${categories.length} categories`}
      />
      <CategoriesManager initialData={categories} />
    </div>
  )
}
