import { requirePortalAuth } from '@/lib/portal/auth'
import { getPortalKbArticles } from '@/lib/portal/actions'
import { PortalKbList } from './portal-kb-list'

export default async function PortalKbPage() {
  await requirePortalAuth()
  const articles = await getPortalKbArticles()

  return <PortalKbList articles={articles as never[]} />
}
