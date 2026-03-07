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
    <div className="-mt-8 md:-mt-10 lg:-mt-12 -mx-6 md:-mx-10 lg:-mx-12">
      <div className="flex items-center h-[60px] border-b border-gray-200 dark:border-slate-700 bg-[#f5f6f8] dark:bg-slate-900 sticky top-0 z-30 px-6 md:px-10 lg:px-12">
        <SettingsNav />
      </div>
      <div className="px-6 md:px-10 lg:px-12 pt-8 pb-8 md:pb-10 lg:pb-12">
        {children}
      </div>
    </div>
  )
}
