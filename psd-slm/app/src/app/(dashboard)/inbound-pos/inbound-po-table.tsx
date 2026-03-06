'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge, INBOUND_PO_STATUS_CONFIG, MATCH_CONFIDENCE_CONFIG } from '@/components/ui/badge'
import { useAuth } from '@/components/auth-provider'
import { deleteInboundPO } from './actions'
import { UploadModal } from './upload-modal'

interface InboundPORow {
  id: string
  status: string
  created_at: string
  customer_po_number: string | null
  customer_name: string | null
  our_reference: string | null
  total_value: number | null
  match_confidence: string | null
  source: string
  customers: { id: string; name: string } | null
  quotes: { id: string; quote_number: string } | null
  reviewer: { id: string; first_name: string; last_name: string } | null
}

interface InboundPOTableProps {
  initialData: InboundPORow[]
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'matched', label: 'Matched' },
  { value: 'extracting', label: 'Extracting' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'error', label: 'Error' },
]

const formatCurrency = (val: number | null) => {
  if (val === null || val === undefined) return '\u2014'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(val)
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function InboundPOTable({ initialData }: InboundPOTableProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InboundPORow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canDelete = user.role.name === 'admin' || user.role.name === 'super_admin'

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteInboundPO(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (result.error) {
      alert(`Delete failed: ${result.error}`)
    } else {
      router.refresh()
    }
  }

  const filtered = initialData.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const matchesSearch =
        item.customer_po_number?.toLowerCase().includes(q) ||
        item.customer_name?.toLowerCase().includes(q) ||
        item.our_reference?.toLowerCase().includes(q) ||
        (item.customers as unknown as { name: string } | null)?.name?.toLowerCase().includes(q) ||
        (item.quotes as unknown as { quote_number: string } | null)?.quote_number?.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    return true
  })

  const columns: Column<InboundPORow>[] = [
    {
      key: 'status',
      label: 'Status',
      nowrap: true,
      render: (row) => {
        const config = INBOUND_PO_STATUS_CONFIG[row.status]
        return config ? <Badge {...config} /> : row.status
      },
    },
    {
      key: 'created_at',
      label: 'Received',
      nowrap: true,
      render: (row) => formatDate(row.created_at),
    },
    {
      key: 'customer_po_number',
      label: 'Customer PO #',
      nowrap: true,
      render: (row) => (
        <span className="font-medium">{row.customer_po_number || '\u2014'}</span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (row) => {
        const company = row.customers as unknown as { name: string } | null
        return company?.name || row.customer_name || '\u2014'
      },
    },
    {
      key: 'our_reference',
      label: 'Our Ref',
      nowrap: true,
      render: (row) => row.our_reference || '\u2014',
    },
    {
      key: 'total_value',
      label: 'Value',
      align: 'right',
      nowrap: true,
      render: (row) => formatCurrency(row.total_value),
    },
    {
      key: 'match_confidence',
      label: 'Match',
      nowrap: true,
      render: (row) => {
        if (!row.match_confidence) return '\u2014'
        const config = MATCH_CONFIDENCE_CONFIG[row.match_confidence]
        return config ? <Badge {...config} /> : row.match_confidence
      },
    },
    {
      key: 'source',
      label: 'Source',
      nowrap: true,
      render: (row) => (
        <span className="text-xs text-slate-500 capitalize">{row.source}</span>
      ),
    },
    {
      key: 'reviewed_by',
      label: 'Reviewed By',
      render: (row) => {
        const reviewer = row.reviewer as unknown as { first_name: string; last_name: string } | null
        return reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : '\u2014'
      },
    },
    ...(canDelete
      ? [
          {
            key: 'actions' as keyof InboundPORow,
            label: '',
            nowrap: true,
            render: (row: InboundPORow) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(row)
                }}
                className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search PO #, customer, reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="sm:ml-auto">
          <Button
            onClick={() => setShowUpload(true)}
            variant="primary"
          >
            Upload PO
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <div className="text-4xl mb-3">📥</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No customer POs yet</h3>
          <p className="text-sm text-slate-400 mb-4">
            Upload a customer&apos;s purchase order PDF to get started.
          </p>
          <Button
            onClick={() => setShowUpload(true)}
            variant="primary"
          >
            Upload PO
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => router.push(`/inbound-pos/${row.id}`)}
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Customer PO</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to delete this customer PO?
            </p>
            <p className="text-sm text-slate-500 mb-4">
              {deleteTarget.customer_po_number && (
                <span className="font-medium text-slate-700">{deleteTarget.customer_po_number}</span>
              )}
              {deleteTarget.customer_po_number && deleteTarget.customer_name && ' — '}
              {deleteTarget.customer_name && (
                <span>{deleteTarget.customer_name}</span>
              )}
              {!deleteTarget.customer_po_number && !deleteTarget.customer_name && (
                <span className="italic">No details extracted</span>
              )}
            </p>
            <p className="text-xs text-red-600 mb-4">
              This will permanently delete the record, its line items, and the uploaded PDF.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={handleDelete}
                variant="danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
