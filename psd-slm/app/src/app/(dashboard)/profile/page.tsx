import { PageHeader } from '@/components/ui/page-header'
import { getMyAiPreferences, getMyViewPreferences } from './actions'
import { AiPreferencesForm } from './ai-preferences-form'
import { DefaultViewsForm } from './default-views-form'
import { ThemeSelector } from './theme-selector'

export default async function ProfilePage() {
  const [aiPrefs, viewPrefs] = await Promise.all([
    getMyAiPreferences(),
    getMyViewPreferences(),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My Profile"
        subtitle="Personal settings and preferences"
      />
      <div className="space-y-8">
        <ThemeSelector />
        <DefaultViewsForm initialPreferences={viewPrefs} />
        <AiPreferencesForm initialPreferences={aiPrefs} />
      </div>
    </div>
  )
}
