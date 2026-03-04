'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import type { JobCollectionWithDetails } from '@/lib/collections/types'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  collected: { label: 'Collected', color: '#059669', bg: '#ecfdf5' },
  partial: { label: 'Partial', color: '#2563eb', bg: '#eff6ff' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6' },
}

export function CollectionsTable({ collections }: { collections: JobCollectionWithDetails[] }) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const filtered = collections.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const customerName = (c.sales_orders?.customers?.name || '').toLowerCase()
      const jobNumber = (c.jobs?.job_number || '').toLowerCase()
      const soNumber = (c.sales_orders?.so_number || '').toLowerCase()
      if (
        !c.slip_number.toLowerCase().includes(q) &&
        !customerName.includes(q) &&
        !jobNumber.includes(q) &&
        !soNumber.includes(q)
      ) return false
    }
    return true
  })

  type Row = JobCollectionWithDetails & { id: string }

  const columns: Column<Row>[] = [
    {
      key: 'slip_number',
      label: 'Slip #',
      nowrap: true,
      render: (row) => (
        <span className="font-semibold text-slate-900">{row.slip_number}</span>
      ),
    },
    {
      key: 'job',
      label: 'Job',
      nowrap: true,
      render: (row) => {
        return <span className="text-slate-600">{row.jobs?.job_number || '—'}</span>
      },
    },
    {
      key: 'so',
      label: 'SO',
      nowrap: true,
      render: (row) => {
        return <span className="text-slate-600">{row.sales_orders?.so_number || '—'}</span>
      },
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => {
        return row.sales_orders?.customers?.name || '—'
      },
    },
    {
      key: 'items',
      label: 'Items',
      nowrap: true,
      align: 'center',
      render: (row) => {
        return row.job_collection_lines?.length || 0
      },
    },
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (row) => {
        const cfg = STATUS_BADGE[row.status] || STATUS_BADGE.pending
        return <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
      },
    },
    {
      key: 'prepared_by',
      label: 'Prepared By',
      nowrap: true,
      render: (row) => {
        const u = row.prepared_by_user
        if (!u) return '—'
        return (
          <div className="flex items-center gap-2">
            <Avatar user={u} size={24} />
            <span className="text-xs">{u.first_name}</span>
          </div>
        )
      },
    },
    {
      key: 'collected_by',
      label: 'Collected By',
      nowrap: true,
      render: (row) => {
        const u = row.collected_by_user
        if (u) {
          return (
            <div className="flex items-center gap-2">
              <Avatar user={u} size={24} />
              <span className="text-xs">{u.first_name}</span>
              {row.collection_latitude != null && <GpsPinIcon />}
            </div>
          )
        }
        if (row.engineer_name) {
          const initials = row.engineer_initials || row.engineer_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
          return (
            <div className="flex items-center gap-2">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold"
                style={{ width: 24, height: 24 }}
              >
                {initials}
              </div>
              <span className="text-xs">{row.engineer_name.split(' ')[0]}</span>
              {row.collection_latitude != null && <GpsPinIcon />}
            </div>
          )
        }
        if (row.status === 'pending') {
          return <span className="text-xs text-amber-600">Pending</span>
        }
        return '—'
      },
    },
    {
      key: 'prepared_at',
      label: 'Prepared',
      nowrap: true,
      render: (row) =>
        row.prepared_at
          ? new Date(row.prepared_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : '—',
    },
    {
      key: 'collected_at',
      label: 'Collected',
      nowrap: true,
      render: (row) =>
        row.collected_at
          ? new Date(row.collected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : '—',
    },
  ]

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search slips, jobs, customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="collected">Collected</option>
          <option value="partial">Partial</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered as Row[]}
        onRowClick={(row) => router.push(`/collections/${row.id}`)}
        emptyMessage="No collections found."
      />
    </div>
  )
}

function GpsPinIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  )
}
