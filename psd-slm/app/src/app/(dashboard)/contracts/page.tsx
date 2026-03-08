import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { formatCurrency } from '@/lib/utils'
import { requireAuth, hasPermission } from '@/lib/auth'
import { getCustomerContracts, getContractStats, getContractAlerts, syncContractAlertStatuses, processExpiredFixedTermContracts, getSupportContractsForInvoicing } from './actions'
import { ContractsTable } from './contracts-table'
import { ContractAlertBanner } from './contracts-alert-banner'
import { ContractsPageTabs } from './contracts-page-tabs'

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function ContractsPage({ searchParams }: PageProps) {
  const { tab } = await searchParams

  // Sync alert statuses and process expired fixed-term contracts
  await Promise.all([syncContractAlertStatuses(), processExpiredFixedTermContracts()])

  const [user, contracts, stats, alerts] = await Promise.all([
    requireAuth(),
    getCustomerContracts(),
    getContractStats(),
    getContractAlerts(),
  ])

  const canCreate = hasPermission(user, 'contracts', 'create')
  const canInvoice = ['super_admin', 'admin', 'finance'].includes(user.role.name)

  // Only fetch invoicing data when tab is active
  const invoicingData = (tab === 'invoicing' && canInvoice)
    ? await getSupportContractsForInvoicing()
    : null

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle={`${contracts.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/contracts/engineer-grid">
              <Button size="sm">Engineer Grid</Button>
            </Link>
            {canCreate && (
              <Link href="/contracts/new">
                <Button size="sm" variant="primary">+ New Contract</Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
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

      <ContractAlertBanner alerts={alerts} />
      <ContractsPageTabs
        activeTab={tab || 'all'}
        contracts={contracts}
        invoicingData={invoicingData}
        showInvoicingTab={canInvoice}
      />
    </div>
  )
}
