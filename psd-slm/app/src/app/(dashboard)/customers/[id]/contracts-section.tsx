'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, CONTRACT_STATUS_CONFIG, CONTRACT_CATEGORY_CONFIG, RENEWAL_PERIOD_CONFIG } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

interface ContractRow {
  id: string
  contract_number: string
  contract_type_name: string
  category: string
  status: string
  effective_frequency: string | null
  effective_visits_per_year: number | null
  annual_value: number | null
  renewal_period: string
  end_date: string
}

interface ContractsSectionProps {
  contracts: ContractRow[]
  customerId: string
}

function getEndDateStyle(endDate: string, status: string): string {
  if (status !== 'active') return ''
  const diffDays = Math.floor((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'text-red-600 font-semibold'
  if (diffDays <= 30) return 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-semibold'
  if (diffDays <= 90) return 'text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-semibold'
  return ''
}

export function ContractsSection({ contracts, customerId }: ContractsSectionProps) {
  const router = useRouter()

  const columns: Column<ContractRow>[] = [
    {
      key: 'contract_number',
      label: 'Contract #',
      nowrap: true,
      render: (r) => <span className="font-semibold text-indigo-600">{r.contract_number}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      nowrap: true,
      render: (r) => {
        const catCfg = CONTRACT_CATEGORY_CONFIG[r.category]
        return (
          <span className="flex items-center gap-1.5">
            <span>{r.contract_type_name}</span>
            {catCfg && <Badge label={catCfg.label} color={catCfg.color} bg={catCfg.bg} />}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (r) => {
        const cfg = CONTRACT_STATUS_CONFIG[r.status]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.status
      },
    },
    {
      key: 'annual_value',
      label: 'Annual Value',
      nowrap: true,
      align: 'right',
      render: (r) => (
        <span className="font-semibold">
          {r.annual_value ? formatCurrency(Number(r.annual_value)) : '\u2014'}
        </span>
      ),
    },
    {
      key: 'renewal_period',
      label: 'Renewal',
      nowrap: true,
      render: (r) => {
        const cfg = RENEWAL_PERIOD_CONFIG[r.renewal_period]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : r.renewal_period
      },
    },
    {
      key: 'end_date',
      label: 'End Date',
      nowrap: true,
      render: (r) => (
        <span className={getEndDateStyle(r.end_date, r.status)}>
          {new Date(r.end_date).toLocaleDateString('en-GB')}
        </span>
      ),
    },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">
          Contracts ({contracts.length})
        </h3>
        <Link
          href={`/contracts/new?company=${customerId}`}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white no-underline hover:bg-indigo-700 transition-colors"
        >
          + Add Contract
        </Link>
      </div>
      <DataTable
        columns={columns}
        data={contracts}
        onRowClick={(r) => router.push(`/contracts/${r.id}`)}
        emptyMessage="No contracts yet."
      />
    </div>
  )
}
