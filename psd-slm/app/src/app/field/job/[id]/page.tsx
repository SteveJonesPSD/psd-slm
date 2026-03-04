import { requireAuth } from '@/lib/auth'
import { getJob } from '@/app/(dashboard)/scheduling/actions'
import { notFound } from 'next/navigation'
import { FieldJobDetail } from './field-job-detail'

export default async function FieldJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth()
  const { id } = await params

  const result = await getJob(id)
  if (result.error || !result.data) return notFound()

  return <FieldJobDetail job={result.data} />
}
