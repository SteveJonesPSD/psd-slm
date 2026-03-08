import { requireAuth } from '@/lib/auth'
import { getJob } from '@/app/(dashboard)/scheduling/actions'
import { getOnsiteJobItems } from '@/app/(dashboard)/helpdesk/onsite-jobs/actions'
import { notFound } from 'next/navigation'
import { FieldJobDetail } from './field-job-detail'

export default async function FieldJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth()
  const { id } = await params

  const result = await getJob(id)
  if (result.error || !result.data) return notFound()

  const customerId = (result.data as Record<string, unknown>).customer_id as string
  let onsiteJobItems: Awaited<ReturnType<typeof getOnsiteJobItems>>['data'] = []
  if (customerId) {
    try {
      const ojiResult = await getOnsiteJobItems({ customerId })
      onsiteJobItems = ojiResult.data || []
    } catch {
      // OJI module may not be deployed
    }
  }

  return <FieldJobDetail job={result.data} onsiteJobItems={onsiteJobItems || []} />
}
