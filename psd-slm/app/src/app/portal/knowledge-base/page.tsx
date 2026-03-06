import { requirePortalSession } from '@/lib/portal/session'
import { getPortalKbArticles } from '@/lib/portal/kb-actions'
import { PortalKbList } from './portal-kb-list'

export default async function PortalKbPage() {
  const ctx = await requirePortalSession()
  const articles = await getPortalKbArticles(ctx)

  return <PortalKbList articles={articles as never[]} />
}
