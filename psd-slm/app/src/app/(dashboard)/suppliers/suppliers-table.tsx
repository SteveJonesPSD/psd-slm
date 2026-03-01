'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { seedSuppliers } from './actions'
import type { Supplier } from '@/types/database'

type SupplierWithCount = Supplier & { product_count: number }

interface SuppliersTableProps {
  suppliers: SupplierWithCount[]
}

export function SuppliersTable({ suppliers }: SuppliersTableProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState('')
  const [showActive, setShowActive] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const canCreate = hasPermission('suppliers', 'create')

  const filtered = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.account_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(search.toLowerCase())
    const matchesActive = !showActive || s.is_active
    return matchesSearch && matchesActive
  })

  const handleSeed = async () => {
    setSeeding(true)
    await seedSuppliers()
    setSeeding(false)
    router.refresh()
  }

  const columns: Column<SupplierWithCount>[] = [
    {
      key: 'account_number',
      label: 'Account #',
      nowrap: true,
      render: (r) => r.account_number ? (
        <span className="font-mono text-xs">{r.account_number}</span>
      ) : '\u2014',
    },
    {
      key: 'name',
      label: 'Supplier',
      render: (r) => <span className="font-semibold">{r.name}</span>,
    },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'payment_terms',
      label: 'Payment Terms',
      render: (r) => `${r.payment_terms} days`,
    },
    {
      key: 'product_count',
      label: 'Products',
      align: 'center',
      render: (r) => r.product_count,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (r) => r.is_active
        ? <Badge label="Active" color="#059669" bg="#ecfdf5" />
        : <Badge label="Inactive" color="#6b7280" bg="#f3f4f6" />,
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showActive}
            onChange={(e) => setShowActive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Active only
        </label>
        <div className="flex-1" />
        {canCreate && (
          <Button variant="primary" onClick={() => router.push('/suppliers/new')}>
            + New Supplier
          </Button>
        )}
      </div>

      {filtered.length === 0 && suppliers.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-400 mb-4">No suppliers yet.</p>
          {canCreate && (
            <Button variant="primary" onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Seeding...' : 'Seed Default Suppliers'}
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(r) => router.push(`/suppliers/${r.id}`)}
          emptyMessage="No suppliers found."
        />
      )}
    </div>
  )
}
