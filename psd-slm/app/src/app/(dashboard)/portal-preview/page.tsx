import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PortalPreviewClient } from './portal-preview-client'

export default async function PortalPreviewPage() {
  const user = await requireAuth()

  // Admin-only page
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    redirect('/')
  }

  return (
    <div>
      <div className="mb-12">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Portal Preview</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          View the customer portal as a specific contact to test and verify their experience
        </p>
      </div>

      <PortalPreviewClient />
    </div>
  )
}
