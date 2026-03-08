import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getXeroSettings, getXeroSyncStats } from '@/lib/xero/xero-actions'
import { XeroSettingsForm } from './xero-settings-form'

export default async function XeroSettingsPage() {
  const user = await requireAuth()
  if (!['super_admin', 'admin'].includes(user.role.name)) {
    redirect('/settings')
  }

  const [settings, stats] = await Promise.all([
    getXeroSettings(),
    getXeroSyncStats().catch(() => ({ synced: 0, failed: 0, notPushed: 0, lastPushedAt: null })),
  ])

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Xero Integration</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
        Configure Xero invoice sync. Engage is the single source of truth &mdash; invoices are pushed to Xero for accounting.
      </p>

      <XeroSettingsForm settings={settings} stats={stats} />
    </div>
  )
}
