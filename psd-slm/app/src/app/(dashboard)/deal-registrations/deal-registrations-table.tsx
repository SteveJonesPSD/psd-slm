'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { seedDealRegistrations } from './actions'
import { formatDate } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending: { color: '#6366f1', bg: '#eef2ff' },
  active: { color: '#059669', bg: '#ecfdf5' },
  expired: { color: '#9ca3af', bg: '#f9fafb' },
  rejected: { color: '#dc2626', bg: '#fef2f2' },
}

interface DealRegRow {
  id: string
  title: string
  reference: string | null
  status: string
  customer_id: string
  supplier_id: string
  customer_name: string
  supplier_name: string
  registered_date: string | null
  expiry_date: string | null
  registered_by_name: string | null
  registered_by_initials: string | null
  registered_by_color: string | null
  line_count: number
}

interface FilterOption {
  id: string
  name: string
}

interface Props {
  dealRegs: DealRegRow[]
  customerOptions: FilterOption[]
  supplierOptions: FilterOption[]
}

function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false
  const expiry = new Date(expiryDate)
  const now = new Date()
  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays > 0 && diffDays <= 30
}

export function DealRegistrationsTable({ dealRegs, customerOptions, supplierOptions }: Props) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [seeding, setSeeding] = useState(false)

  const canCreate = hasPermission('deal_registrations', 'create')

  const filtered = dealRegs.filter((dr) => {
    const matchesSearch =
      dr.title.toLowerCase().includes(search.toLowerCase()) ||
      (dr.reference || '').toLowerCase().includes(search.toLowerCase()) ||
      dr.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      dr.supplier_name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !statusFilter || dr.status === statusFilter
    const matchesCustomer = !customerFilter || dr.customer_id === customerFilter
    const matchesSupplier = !supplierFilter || dr.supplier_id === supplierFilter
    return matchesSearch && matchesStatus && matchesCustomer && matchesSupplier
  })

  const handleSeed = async () => {
    setSeeding(true)
    await seedDealRegistrations()
    setSeeding(false)
    router.refresh()
  }

  const columns: Column<DealRegRow>[] = [
    {
      key: 'reference',
      label: 'Reference',
      nowrap: true,
      render: (r) =>
        r.reference ? (
          <span className="font-mono text-xs">{r.reference}</span>
        ) : (
          '\u2014'
        ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (r) => <span className="font-semibold">{r.title}</span>,
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (r) => r.customer_name,
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      render: (r) => r.supplier_name,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending
        return <Badge label={r.status} color={cfg.color} bg={cfg.bg} />
      },
    },
    {
      key: 'registered_date',
      label: 'Registered',
      nowrap: true,
      render: (r) => (r.registered_date ? formatDate(r.registered_date) : '\u2014'),
    },
    {
      key: 'expiry_date',
      label: 'Expiry',
      nowrap: true,
      render: (r) => {
        if (!r.expiry_date) return '\u2014'
        const expiring = isExpiringSoon(r.expiry_date)
        return (
          <span className={expiring ? 'text-amber-600 font-medium' : ''}>
            {formatDate(r.expiry_date)}
            {expiring && ' \u26a0'}
          </span>
        )
      },
    },
    {
      key: 'line_count',
      label: 'Lines',
      align: 'center',
      render: (r) => r.line_count,
    },
    {
      key: 'registered_by_name',
      label: 'Registered By',
      render: (r) => {
        if (!r.registered_by_name) return '\u2014'
        return (
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: r.registered_by_color || '#6366f1' }}
            >
              {r.registered_by_initials || r.registered_by_name.split(' ').map((n) => n[0]).join('')}
            </div>
            <span className="text-xs">{r.registered_by_name}</span>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search deal registrations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Customers</option>
          {customerOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">All Suppliers</option>
          {supplierOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        {canCreate && (
          <Button variant="primary" onClick={() => router.push('/deal-registrations/new')}>
            + New Deal Registration
          </Button>
        )}
      </div>

      {filtered.length === 0 && dealRegs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400 mb-4">No deal registrations yet.</p>
          {canCreate && (
            <Button variant="primary" onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Seeding...' : 'Seed Sample Deal Registrations'}
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(r) => router.push(`/deal-registrations/${r.id}`)}
          emptyMessage="No deal registrations found."
        />
      )}
    </div>
  )
}
