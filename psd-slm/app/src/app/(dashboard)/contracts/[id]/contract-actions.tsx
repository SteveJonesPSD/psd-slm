'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateContractStatus, renewContract } from '../actions'
import { Button } from '@/components/ui/button'
import type { CustomerContractWithDetails } from '@/lib/contracts/types'

interface ContractActionsProps {
  contract: CustomerContractWithDetails
}

export function ContractActions({ contract }: ContractActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [showRenewal, setShowRenewal] = useState(false)

  const handleStatusChange = async (status: string) => {
    setLoading(status)
    const result = await updateContractStatus(contract.id, status)
    setLoading('')
    if (result.error) alert(result.error)
    else router.refresh()
    setShowCancel(false)
  }

  const handleRenewal = async (formData: FormData) => {
    setLoading('renew')
    const result = await renewContract(contract.id, formData)
    setLoading('')
    if (result.error) {
      alert(result.error)
    } else if (result.data) {
      router.push(`/contracts/${result.data.id}`)
    }
    setShowRenewal(false)
  }

  const isEditable = ['draft', 'active'].includes(contract.status)

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {contract.status === 'draft' && (
          <Button
            onClick={() => handleStatusChange('active')}
            variant="success"
            disabled={!!loading}
          >
            {loading === 'active' ? 'Activating...' : 'Activate'}
          </Button>
        )}

        {contract.status === 'draft' && (
          <button
            disabled
            title="E-Sign module coming soon"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
          >
            Send for Signature
          </button>
        )}

        {contract.status === 'active' && (
          <Button
            onClick={() => setShowRenewal(true)}
            variant="primary"
            disabled={!!loading}
          >
            Renew Contract
          </Button>
        )}

        {isEditable && (
          <button
            onClick={() => setShowCancel(true)}
            disabled={!!loading}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Cancel Contract
          </button>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Cancel Contract?</h3>
            <p className="text-sm text-slate-500 mb-4">
              This will mark <strong>{contract.contract_number}</strong> as cancelled. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancel(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep Active
              </button>
              <Button
                onClick={() => handleStatusChange('cancelled')}
                variant="danger"
                disabled={!!loading}
              >
                {loading === 'cancelled' ? 'Cancelling...' : 'Cancel Contract'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Renewal modal */}
      {showRenewal && (
        <RenewalModal
          contract={contract}
          onClose={() => setShowRenewal(false)}
          onSubmit={handleRenewal}
          loading={loading === 'renew'}
        />
      )}
    </>
  )
}

function RenewalModal({
  contract,
  onClose,
  onSubmit,
  loading,
}: {
  contract: CustomerContractWithDetails
  onClose: () => void
  onSubmit: (formData: FormData) => void
  loading: boolean
}) {
  const oldEnd = new Date(contract.end_date)
  const newStart = new Date(oldEnd)
  newStart.setDate(newStart.getDate() + 1)
  const newEnd = new Date(newStart)
  newEnd.setFullYear(newEnd.getFullYear() + 1)
  newEnd.setDate(newEnd.getDate() - 1)

  const [startDate, setStartDate] = useState(newStart.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(newEnd.toISOString().split('T')[0])
  const [annualValue, setAnnualValue] = useState(String(contract.annual_value || ''))
  const [notes, setNotes] = useState('')

  const valueChanged = Number(annualValue) !== Number(contract.annual_value)

  const handleSubmit = () => {
    const fd = new FormData()
    fd.append('new_start_date', startDate)
    fd.append('new_end_date', endDate)
    fd.append('annual_value', annualValue)
    if (notes) fd.append('notes', notes)
    onSubmit(fd)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Renew Contract</h3>
        <p className="text-sm text-slate-500 mb-4">
          {contract.contract_number} &mdash; {contract.customer_name} &mdash; {contract.contract_type_name}
        </p>

        <div className="space-y-3 mb-4">
          <div className="text-xs text-slate-400">New version: v{(contract.version || 1) + 1}</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Annual Value (GBP)
              {valueChanged && (
                <span className="ml-2 text-amber-600 text-xs font-normal">
                  Changed from {contract.annual_value ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(contract.annual_value)) : '\u2014'}
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={annualValue}
              onChange={(e) => setAnnualValue(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none ${
                valueChanged ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Renewal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Renewing...' : 'Confirm Renewal'}
          </Button>
        </div>
      </div>
    </div>
  )
}
