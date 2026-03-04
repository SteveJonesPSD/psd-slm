'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import {
  CONTRACT_STATUS_CONFIG,
  CONTRACT_CATEGORY_CONFIG,
  RENEWAL_PERIOD_CONFIG,
} from '@/components/ui/badge'
import type { CustomerContractWithDetails } from '@/lib/contracts/types'
import {
  CONTRACT_CATEGORIES,
  CONTRACT_STATUSES,
  RENEWAL_PERIODS,
} from '@/lib/contracts/types'

interface ContractsTableProps {
  contracts: CustomerContractWithDetails[]
  hideCompany?: boolean
}

function formatFrequency(f: string | null): string {
  if (!f) return '\u2014'
  return f.charAt(0).toUpperCase() + f.slice(1)
}

function getEndDateStyle(endDate: string): { className: string } {
  const now = new Date()
  const end = new Date(endDate)
  const diffDays = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { className: 'text-red-600 font-semibold' }
  if (diffDays <= 30) return { className: 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-semibold' }
  if (diffDays <= 90) return { className: 'text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-semibold' }
  return { className: '' }
}

export function ContractsTable({ contracts, hideCompany }: ContractsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [renewalFilter, setRenewalFilter] = useState('')

  const filtered = useMemo(() => {
    let result = contracts
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.contract_number.toLowerCase().includes(s) ||
          c.customer_name.toLowerCase().includes(s)
      )
    }
    if (statusFilter) result = result.filter((c) => c.status === statusFilter)
    if (categoryFilter) result = result.filter((c) => c.category === categoryFilter)
    if (renewalFilter) result = result.filter((c) => c.renewal_period === renewalFilter)
    return result
  }, [contracts, search, statusFilter, categoryFilter, renewalFilter])

  const columns: Column<CustomerContractWithDetails>[] = [
    {
      key: 'contract_number',
      label: 'Contract #',
      nowrap: true,
      render: (r) => <span className="font-semibold text-indigo-600">{r.contract_number}</span>,
    },
    ...(hideCompany
      ? []
      : [
          {
            key: 'customer_name',
            label: 'Company',
            render: (r: CustomerContractWithDetails) => r.customer_name,
          } as Column<CustomerContractWithDetails>,
        ]),
    {
      key: 'type',
      label: 'Type',
      nowrap: true,
      render: (r) => {
        const catCfg = CONTRACT_CATEGORY_CONFIG[r.category]
        return (
          <span className="flex items-center gap-1.5">
            <span className="text-sm">{r.contract_type_name}</span>
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
      key: 'frequency',
      label: 'Frequency',
      nowrap: true,
      render: (r) => formatFrequency(r.effective_frequency),
    },
    {
      key: 'visits',
      label: 'Visits/Yr',
      nowrap: true,
      align: 'center',
      render: (r) => r.effective_visits_per_year ?? '\u2014',
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
      render: (r) => {
        const style = r.status === 'active' ? getEndDateStyle(r.end_date) : { className: '' }
        return (
          <span className={style.className}>
            {new Date(r.end_date).toLocaleDateString('en-GB')}
          </span>
        )
      },
    },
    {
      key: 'signed',
      label: 'Signed',
      nowrap: true,
      align: 'center',
      render: (r) =>
        r.last_signed_at ? (
          <span className="text-green-600" title={new Date(r.last_signed_at).toLocaleDateString('en-GB')}>
            ✓
          </span>
        ) : (
          <span className="text-slate-300">\u2014</span>
        ),
    },
  ]

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search contracts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {CONTRACT_STATUSES.map((s) => {
            const cfg = CONTRACT_STATUS_CONFIG[s]
            return (
              <option key={s} value={s}>
                {cfg?.label || s}
              </option>
            )
          })}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All Categories</option>
          {CONTRACT_CATEGORIES.map((c) => {
            const cfg = CONTRACT_CATEGORY_CONFIG[c]
            return (
              <option key={c} value={c}>
                {cfg?.label || c}
              </option>
            )
          })}
        </select>
        <select
          value={renewalFilter}
          onChange={(e) => setRenewalFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All Renewals</option>
          {RENEWAL_PERIODS.map((p) => {
            const cfg = RENEWAL_PERIOD_CONFIG[p]
            return (
              <option key={p} value={p}>
                {cfg?.label || p}
              </option>
            )
          })}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/contracts/${r.id}`)}
        emptyMessage="No contracts found."
      />
    </div>
  )
}
