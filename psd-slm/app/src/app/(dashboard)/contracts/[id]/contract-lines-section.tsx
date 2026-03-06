'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { addContractLine, updateContractLine, deleteContractLine } from '../actions'
import type { ContractLine } from '@/lib/contracts/types'

interface ContractLinesSectionProps {
  contractId: string
  lines: ContractLine[]
  editable: boolean
}

export function ContractLinesSection({ contractId, lines, editable }: ContractLinesSectionProps) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [editingLine, setEditingLine] = useState<ContractLine | null>(null)

  const linesTotal = lines.reduce((s, l) => s + (Number(l.quantity) * (Number(l.unit_price_annual) || 0)), 0)

  const columns: Column<ContractLine>[] = [
    {
      key: 'description',
      label: 'Description',
      render: (r) => r.description,
    },
    {
      key: 'unit_type',
      label: 'Unit Type',
      nowrap: true,
      render: (r) => r.unit_type || '\u2014',
    },
    {
      key: 'quantity',
      label: 'Qty',
      nowrap: true,
      align: 'center',
      render: (r) => Number(r.quantity),
    },
    {
      key: 'unit_price_annual',
      label: 'Unit Price (Annual)',
      nowrap: true,
      align: 'right',
      render: (r) => r.unit_price_annual ? formatCurrency(Number(r.unit_price_annual)) : '\u2014',
    },
    {
      key: 'location',
      label: 'Location',
      render: (r) => r.location || '\u2014',
    },
    ...(editable
      ? [
          {
            key: 'actions',
            label: '',
            nowrap: true,
            align: 'right' as const,
            render: (r: ContractLine) => (
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingLine(r) }}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Edit
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (confirm('Delete this line?')) {
                      await deleteContractLine(r.id, contractId)
                      router.refresh()
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            ),
          } as Column<ContractLine>,
        ]
      : []),
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Contract Lines ({lines.length})</h3>
        {editable && (
          <Button
            onClick={() => setShowAdd(true)}
            variant="primary"
            size="sm"
          >
            + Add Line
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={lines} emptyMessage="No line items yet." />

      {lines.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
          <div className="text-sm text-slate-500">
            Line Items Total (informational): <span className="font-semibold text-slate-700">{formatCurrency(linesTotal)}</span>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {(showAdd || editingLine) && (
        <LineModal
          contractId={contractId}
          line={editingLine}
          onClose={() => { setShowAdd(false); setEditingLine(null) }}
          onSaved={() => { setShowAdd(false); setEditingLine(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function LineModal({
  contractId,
  line,
  onClose,
  onSaved,
}: {
  contractId: string
  line: ContractLine | null
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    description: line?.description || '',
    unit_type: line?.unit_type || '',
    quantity: String(line?.quantity ?? 1),
    unit_price_annual: line?.unit_price_annual ? String(line.unit_price_annual) : '',
    location: line?.location || '',
    notes: line?.notes || '',
  })

  const upd = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    if (!form.description.trim()) {
      setError('Description is required')
      return
    }
    setSaving(true)
    setError('')

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))

    const result = line
      ? await updateContractLine(line.id, contractId, fd)
      : await addContractLine(contractId, fd)

    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {line ? 'Edit Line' : 'Add Line'}
        </h3>

        {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input type="text" value={form.description} onChange={upd('description')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit Type</label>
              <input type="text" value={form.unit_type} onChange={upd('unit_type')} placeholder="e.g. door, camera, device" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input type="number" min="0" step="1" value={form.quantity} onChange={upd('quantity')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit Price (Annual)</label>
              <input type="number" step="0.01" min="0" value={form.unit_price_annual} onChange={upd('unit_price_annual')} placeholder="0.00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input type="text" value={form.location} onChange={upd('location')} placeholder="e.g. Main Entrance" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={upd('notes')} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <Button onClick={handleSave} variant="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
