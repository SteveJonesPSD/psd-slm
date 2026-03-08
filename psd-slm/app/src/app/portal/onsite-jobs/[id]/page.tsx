import { requirePortalSession } from '@/lib/portal/session'
import { getPortalOnsiteJobItem } from '@/lib/portal/onsite-job-actions'
import { notFound } from 'next/navigation'
import { PortalOnsiteJobDetail } from './portal-onsite-job-detail'

export default async function PortalOnsiteJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePortalSession()
  const { id } = await params

  const result = await getPortalOnsiteJobItem(id, ctx)
  if (!result) return notFound()

  return (
    <PortalOnsiteJobDetail
      item={result.item}
      audit={result.audit}
      portalUserId={ctx.portalUserId}
    />
  )
}
