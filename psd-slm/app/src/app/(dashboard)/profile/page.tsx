import { PageHeader } from '@/components/ui/page-header'
import { getMyAiPreferences } from './actions'
import { AiPreferencesForm } from './ai-preferences-form'
import { ThemeSelector } from './theme-selector'

export default async function ProfilePage() {
  const prefs = await getMyAiPreferences()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My Profile"
        subtitle="Personal settings and AI response preferences"
      />
      <div className="space-y-6">
        <ThemeSelector />
        <AiPreferencesForm initialPreferences={prefs} />
      </div>
    </div>
  )
}
