import { getTags } from '../actions'
import { requirePermission } from '@/lib/auth'
import { TagsManager } from './tags-manager'

export default async function TagsPage() {
  await requirePermission('helpdesk', 'admin')
  const result = await getTags()
  const tags = result.data || []

  return <TagsManager initialData={tags} />
}
