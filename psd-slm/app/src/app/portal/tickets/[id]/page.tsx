import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OldPortalTicketDetailPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/portal/helpdesk/${id}`)
}
