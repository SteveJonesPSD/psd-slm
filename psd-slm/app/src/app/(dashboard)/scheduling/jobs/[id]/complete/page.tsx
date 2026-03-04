import { requireAuth } from '@/lib/auth'
import { getJob } from '../../../actions'
import { notFound } from 'next/navigation'
import { SchedulingCompletionForm } from './scheduling-completion-form'

export default async function SchedulingCompletionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const { id } = await params

  const result = await getJob(id)
  if (result.error || !result.data) return notFound()

  const currentUserName = `${user.firstName} ${user.lastName}`

  return <SchedulingCompletionForm job={result.data} currentUserName={currentUserName} />
}
