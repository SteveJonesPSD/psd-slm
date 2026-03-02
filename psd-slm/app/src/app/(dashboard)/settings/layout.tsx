import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { SettingsNav } from '@/components/settings/settings-nav'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  // Only admin and super_admin can access settings
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    redirect('/')
  }

  return (
    <div className="flex gap-8">
      <SettingsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
