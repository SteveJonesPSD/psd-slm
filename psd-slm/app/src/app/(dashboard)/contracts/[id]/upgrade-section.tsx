'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getUpgradeCalculation, upgradeContract } from '../actions'

interface UpgradeSectionProps {
  contractId: string
  contractNumber: string
}

export function UpgradeSection({ contractId, contractNumber }: UpgradeSectionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const [goLiveDate, setGoLiveDate] = useState(new Date().toISOString().split('T')[0])
  const [calc, setCalc] = useState<{
    invoiceNumber?: string
    periodStart?: string
    periodEnd?: string
    invoiceAmount?: number
    daysRemaining?: number
    daysInPeriod?: number
    creditAmount?: number
    error?: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    creditNoteId?: string
    creditNoteNumber?: string
    creditAmount?: number
  } | null>(null)

  useEffect(() => {
    if (step === 2 && goLiveDate) {
      const timer = setTimeout(() => {
        getUpgradeCalculation(contractId, goLiveDate).then(setCalc)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [contractId, goLiveDate, step])

  const handleUpgrade = async () => {
    setLoading(true)
    const res = await upgradeContract(contractId, goLiveDate)
    setLoading(false)
    if (res.error) {
      alert(res.error)
    } else {
      setResult({ creditNoteId: res.creditNoteId, creditNoteNumber: res.creditNoteNumber, creditAmount: res.creditAmount })
      router.refresh()
    }
  }

  const reset = () => {
    setOpen(false)
    setStep(1)
    setConfirmed(false)
    setCalc(null)
    setResult(null)
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold">Upgrade Contract</h3>
            <p className="text-xs text-slate-400 mt-1">
              Upgrading will supersede this contract when the new service goes live.
              A new quote and sales order must be raised separately for the upgraded service.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            Upgrade Contract
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-5 mb-8">
      <h3 className="text-[15px] font-semibold mb-4">Upgrade Contract</h3>

      {result ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 text-lg">&#10003;</span>
            <span className="font-semibold text-green-800">Contract superseded.</span>
          </div>
          <p className="text-sm text-green-700 mb-3">
            Draft credit note <strong>{result.creditNoteNumber}</strong> created
            for <strong>{formatCurrency(result.creditAmount || 0)}</strong>
          </p>
          <div className="flex gap-2">
            {result.creditNoteId && (
              <Link href={`/invoices/${result.creditNoteId}`}>
                <Button variant="primary" size="sm">View Credit Note</Button>
              </Link>
            )}
            <Button variant="default" size="sm" onClick={reset}>Close</Button>
          </div>
        </div>
      ) : step === 1 ? (
        <div>
          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span className="text-sm text-slate-700">
              I confirm a new quote and sales order have been / will be raised for the upgraded service,
              and a new contract will be created from that quote.
            </span>
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => setStep(2)} disabled={!confirmed}>
              Continue
            </Button>
            <Button variant="default" size="sm" onClick={reset}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Go-Live Date</label>
            <input
              type="date"
              value={goLiveDate}
              onChange={(e) => setGoLiveDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              The date the new service went live (or will go live).
            </p>
          </div>

          {calc?.error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-800">
              {calc.error}
            </div>
          ) : calc ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 mb-4 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Most recent invoice:</span>
                <span className="font-medium">{calc.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice period:</span>
                <span>{calc.periodStart && calc.periodEnd ?
                  `${new Date(calc.periodStart).toLocaleDateString('en-GB')} – ${new Date(calc.periodEnd).toLocaleDateString('en-GB')}`
                  : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice amount:</span>
                <span>{formatCurrency(calc.invoiceAmount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Go-live date:</span>
                <span>{new Date(goLiveDate).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Days remaining:</span>
                <span>{calc.daysRemaining} of {calc.daysInPeriod}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                <span className="font-semibold text-slate-700">Pro-rata credit:</span>
                <span className="font-bold text-green-700">{formatCurrency(calc.creditAmount || 0)}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4 mb-4 text-sm text-slate-400 text-center">
              Calculating...
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleUpgrade}
              disabled={loading || !!calc?.error || !calc}
            >
              {loading ? 'Processing...' : 'Create Draft Credit Note & Supersede Contract'}
            </Button>
            <Button variant="default" size="sm" onClick={() => setStep(1)}>Back</Button>
            <Button variant="default" size="sm" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
