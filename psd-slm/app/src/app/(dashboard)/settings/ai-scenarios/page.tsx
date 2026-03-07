import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { getScenarios, getExecutionStats, getExecutionLog } from '@/lib/ai-scenarios/actions'
import { AiScenariosSettings } from './ai-scenarios-settings'

export default async function AiScenariosPage() {
  await requirePermission('settings', 'view')

  const [scenarios, stats, executions] = await Promise.all([
    getScenarios(),
    getExecutionStats(),
    getExecutionLog({ limit: 100 }),
  ])

  return (
    <div>
      <AiScenariosSettings
        scenarios={scenarios}
        stats={stats}
        executions={executions}
      />
    </div>
  )
}
