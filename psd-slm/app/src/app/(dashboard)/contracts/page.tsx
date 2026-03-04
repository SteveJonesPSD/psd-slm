import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { formatCurrency } from '@/lib/utils'
import { getCustomerContracts, getContractStats } from './actions'
import { ContractsTable } from './contracts-table'

export default async function ContractsPage() {
  const [contracts, stats] = await Promise.all([
    getCustomerContracts(),
    getContractStats(),
  ])

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle={`${contracts.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/contracts/engineer-grid"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50 transition-colors"
            >
              Engineer Grid
            </Link>
            <Link
              href="/contracts/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-indigo-700 transition-colors"
            >
              + New Contract
            </Link>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
        <StatCard
          label="Active Contracts"
          value={stats.activeCount}
          accent="#059669"
        />
        <StatCard
          label="Total Annual Value"
          value={formatCurrency(stats.totalAnnualValue)}
          accent="#6366f1"
        />
        <StatCard
          label="Due for Renewal"
          value={stats.dueRenewalCount}
          sub="Within 90 days"
          accent={stats.dueRenewalCount > 0 ? '#d97706' : undefined}
        />
        <StatCard
          label="Pending Signature"
          value={stats.pendingSignatureCount}
        />
      </div>

      <ContractsTable contracts={contracts} />
    </div>
  )
}
