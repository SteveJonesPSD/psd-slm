'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, SCHEDULE_STATUS_CONFIG } from '@/components/ui/badge'
import {
  processPendingContractInvoices,
  updateScheduleAmountOverride,
  skipScheduleRow,
} from '../actions'
import type { ContractInvoiceSchedule } from '@/lib/contracts/types'

interface InvoiceScheduleSectionProps {
  contractId: string
  schedule: ContractInvoiceSchedule[]
  editable: boolean
}

export function InvoiceScheduleSection({ contractId, schedule, editable }: InvoiceScheduleSectionProps) {
  const router = useRouter()
  const [processing, setProcessing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [skipId, setSkipId] = useState<string | null>(null)
  const [skipNotes, setSkipNotes] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // Auto-process pending invoices on mount
  useEffect(() => {
    const hasDue = schedule.some(
      r => r.status === 'pending' && new Date(r.scheduled_date) <= new Date()
    )
    if (hasDue) {
      processPendingContractInvoices(contractId).then(result => {
        if (result.processed > 0) {
          setToast(`${result.processed} invoice draft${result.processed > 1 ? 's' : ''} created.`)
          router.refresh()
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleProcess = async () => {
    setProcessing(true)
    const result = await processPendingContractInvoices(contractId)
    setProcessing(false)
    if (result.processed > 0) {
      setToast(`${result.processed} invoice draft${result.processed > 1 ? 's' : ''} created.`)
      router.refresh()
    } else if (result.errors.length > 0) {
      alert(`Errors: ${result.errors.join(', ')}`)
    } else {
      setToast('No pending invoices due yet.')
    }
  }

  const handleOverrideSave = async (rowId: string) => {
    const val = editValue.trim() === '' ? null : Number(editValue)
    const result = await updateScheduleAmountOverride(rowId, val)
    if (result.error) alert(result.error)
    else router.refresh()
    setEditingId(null)
  }

  const handleSkip = async () => {
    if (!skipId) return
    const result = await skipScheduleRow(skipId, skipNotes)
    if (result.error) alert(result.error)
    else router.refresh()
    setSkipId(null)
    setSkipNotes('')
  }

  const pendingCount = schedule.filter(r => r.status === 'pending').length

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-8">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="text-[15px] font-semibold">
          Invoice Schedule
          {pendingCount > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              {pendingCount} pending
            </span>
          )}
        </h3>
        {editable && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleProcess}
            disabled={processing}
          >
            {processing ? 'Processing...' : 'Process Pending'}
          </Button>
        )}
      </div>

      {toast && (
        <div className="mx-5 mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {toast}
        </div>
      )}

      {schedule.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          No invoice schedule generated yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Scheduled Date</th>
                <th className="py-3 px-4 text-center">Pro-rata</th>
                <th className="py-3 px-4 text-right">Base Amount</th>
                <th className="py-3 px-4 text-right">Override</th>
                <th className="py-3 px-4 text-right">Effective</th>
                <th className="py-3 px-4">Invoice</th>
                <th className="py-3 px-4">Status</th>
                {editable && <th className="py-3 px-4">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedule.map(row => {
                const statusCfg = SCHEDULE_STATUS_CONFIG[row.status]
                const effectiveAmount = row.amount_override ?? row.base_amount
                const isPending = row.status === 'pending'

                return (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-700">{row.period_label}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(row.scheduled_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.is_prorata && (
                        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                          title={row.prorata_days != null ? `${row.prorata_days} of ${row.prorata_total_days} days` : undefined}
                        >
                          Pro-rata
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {formatCurrency(Number(row.base_amount))}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {editingId === row.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-indigo-400 focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleOverrideSave(row.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                          />
                          <button
                            onClick={() => handleOverrideSave(row.id)}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {row.amount_override != null ? (
                            <span className="font-semibold text-amber-600">
                              {formatCurrency(Number(row.amount_override))}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                          {isPending && editable && (
                            <button
                              onClick={() => {
                                setEditingId(row.id)
                                setEditValue(row.amount_override != null ? String(row.amount_override) : '')
                              }}
                              className="ml-1 text-slate-400 hover:text-slate-600"
                              title="Override amount"
                            >
                              &#9998;
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td className={`py-3 px-4 text-right ${row.amount_override != null ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                      {formatCurrency(Number(effectiveAmount))}
                    </td>
                    <td className="py-3 px-4">
                      {row.invoice_id ? (
                        <Link
                          href={`/invoices/${row.invoice_id}`}
                          className="text-indigo-600 hover:text-indigo-800 no-underline text-xs"
                        >
                          {row.invoice_number || 'View'}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-300">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {statusCfg ? (
                        <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />
                      ) : (
                        <span className="text-xs text-slate-400">{row.status}</span>
                      )}
                    </td>
                    {editable && (
                      <td className="py-3 px-4">
                        {isPending && (
                          <button
                            onClick={() => setSkipId(row.id)}
                            className="text-xs text-slate-500 hover:text-red-600"
                          >
                            Skip
                          </button>
                        )}
                        {row.status === 'draft_created' && row.invoice_id && (
                          <Link
                            href={`/invoices/${row.invoice_id}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 no-underline"
                          >
                            View Invoice
                          </Link>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Billing cycle note */}
      <div className="px-5 py-3 border-t border-gray-100 text-xs text-slate-400">
        {schedule.some(r => r.is_prorata)
          ? 'Year 1 is pro-rata from activation date to the next billing date.'
          : 'Year 1 is invoiced via the Sales Order. This schedule covers Year 2 onwards.'}
      </div>

      {/* Skip modal */}
      {skipId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Skip Invoice Period</h3>
            <p className="text-sm text-slate-500 mb-4">
              This period will be marked as skipped and no invoice will be generated.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <textarea
                value={skipNotes}
                onChange={(e) => setSkipNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                placeholder="Why is this period being skipped?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="default" size="sm" onClick={() => { setSkipId(null); setSkipNotes('') }}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleSkip} disabled={!skipNotes.trim()}>
                Skip Period
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
