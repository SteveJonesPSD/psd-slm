import { getDashboardStats, getDashboardPanels } from '../actions'
import { TeamDashboard } from './team-dashboard'

export default async function DashboardPage() {
  const [stats, panels] = await Promise.all([
    getDashboardStats(),
    getDashboardPanels(),
  ])

  return <TeamDashboard stats={stats} panels={panels} />
}
