import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { getMyAiPreferences, getMyViewPreferences, getMyNotificationPreferences } from './actions'
import { AiPreferencesForm } from './ai-preferences-form'
import { DefaultViewsForm } from './default-views-form'
import { NotificationPreferencesForm } from './notification-preferences-form'
import { ThemeSelector } from './theme-selector'

export default async function ProfilePage() {
  const [aiPrefs, viewPrefs, notifPrefs] = await Promise.all([
    getMyAiPreferences(),
    getMyViewPreferences(),
    getMyNotificationPreferences(),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My Profile"
        subtitle="Personal settings and preferences"
      />
      <div className="space-y-8">
        {/* Security card */}
        <Link
          href="/profile/security"
          className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 no-underline hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30">
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Security</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Password, passkeys, MFA, and trusted devices</p>
            </div>
          </div>
          <svg className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        <ThemeSelector />
        <DefaultViewsForm initialPreferences={viewPrefs} />
        <NotificationPreferencesForm initialPreferences={notifPrefs} />
        <AiPreferencesForm initialPreferences={aiPrefs} />
      </div>
    </div>
  )
}
