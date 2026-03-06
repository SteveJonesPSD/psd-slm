import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PortalAuthPage({ params }: PageProps) {
  const { token } = await params
  // Redirect to the verify API route which handles session creation
  redirect(`/api/portal/auth/verify?token=${encodeURIComponent(token)}`)
}
