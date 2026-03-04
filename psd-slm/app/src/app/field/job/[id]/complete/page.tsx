import { requireAuth } from '@/lib/auth'
import { getJob } from '@/app/(dashboard)/scheduling/actions'
import { notFound } from 'next/navigation'
import { CompletionForm } from './completion-form'

export default async function CompletionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const { id } = await params

  const result = await getJob(id)
  if (result.error || !result.data) return notFound()

  const currentUserName = `${user.firstName} ${user.lastName}`

  return <CompletionForm job={result.data} currentUserName={currentUserName} />
}
