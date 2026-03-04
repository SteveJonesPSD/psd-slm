import { getCollections, getCollectionStats } from '@/lib/collections/actions'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { CollectionsTable } from './collections-table'

export default async function CollectionsPage() {
  const [collections, stats] = await Promise.all([
    getCollections(),
    getCollectionStats(),
  ])

  return (
    <div>
      <PageHeader title="Collections" subtitle="Engineer stock collection slips" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Pending Pickup"
          value={stats.pending}
          accent="#d97706"
        />
        <StatCard
          label="Collected Today"
          value={stats.collectedToday}
          accent="#059669"
        />
        <StatCard
          label="This Week"
          value={stats.thisWeek}
        />
      </div>

      <CollectionsTable collections={collections} />
    </div>
  )
}
