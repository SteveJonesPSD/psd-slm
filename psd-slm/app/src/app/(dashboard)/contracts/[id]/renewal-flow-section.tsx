'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  generateRenewalQuote,
  markRenewalQuoteSent,
  markRenewalQuoteAccepted,
  completeRenewalSigning,
} from '../actions'
import { TERM_MONTH_OPTIONS } from '@/lib/contracts/types'

interface RenewalFlowSectionProps {
  contractId: string
  contractNumber: string
  daysRemaining: number | null
  isOpenEnded: boolean
  renewalState: {
    renewalQuoteId?: string
    renewalQuoteNumber?: string
    workflowStatus?: string
    newContractId?: string
    newContractNumber?: string
  } | null
}

export function RenewalFlowSection({
  contractId,
  contractNumber,
  daysRemaining,
  isOpenEnded,
  renewalState,
}: RenewalFlowSectionProps) {
  const router = useRouter()
  const [loading, setLoading] = useState('')
  const [showTermModal, setShowTermModal] = useState(false)
  const [termMonths, setTermMonths] = useState<string>('12')

  const status = renewalState?.workflowStatus || 'none'

  const handleGenerate = async () => {
    setLoading('generate')
    const result = await generateRenewalQuote(contractId)
    setLoading('')
    if (result.error) alert(result.error)
    else router.refresh()
  }

  const handleMarkSent = async () => {
    setLoading('sent')
    const result = await markRenewalQuoteSent(contractId)
    setLoading('')
    if (result.error) alert(result.error)
    else router.refresh()
  }

  const handleMarkAccepted = async () => {
    setLoading('accepted')
    const result = await markRenewalQuoteAccepted(contractId)
    setLoading('')
    if (result.error) alert(result.error)
    else router.refresh()
  }

  const handleComplete = async () => {
    setLoading('complete')
    const term = termMonths === 'open' ? null : Number(termMonths)
    const result = await completeRenewalSigning(contractId, term)
    setLoading('')
    setShowTermModal(false)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
      <h3 className="text-[15px] font-semibold mb-4">Contract Renewal</h3>

      {status === 'none' || status === 'pending' ? (
        <div>
          {isOpenEnded ? (
            <p className="text-sm text-slate-500 mb-4">
              This contract has no fixed end date. To renegotiate terms or update
              licensed items, generate a renewal quote from the current contract lines.
            </p>
          ) : daysRemaining !== null ? (
            <p className="text-sm text-slate-500 mb-4">
              This contract expires in <strong>{daysRemaining} days</strong>.
            </p>
          ) : null}
          <Button variant="primary" size="sm" onClick={handleGenerate} disabled={!!loading}>
            {loading === 'generate' ? 'Generating...' : 'Generate Renewal Quote'}
          </Button>
        </div>
      ) : status === 'quote_generated' ? (
        <div>
          <p className="text-sm text-slate-700 mb-1">
            Renewal quote <strong>{renewalState?.renewalQuoteNumber}</strong> has been generated.
          </p>
          <p className="text-xs text-slate-400 mb-4">Status: Draft</p>
          <div className="flex items-center gap-2">
            {renewalState?.renewalQuoteId && (
              <Link href={`/quotes/${renewalState.renewalQuoteId}`}>
                <Button variant="blue" size="sm">View Renewal Quote</Button>
              </Link>
            )}
            <Button variant="primary" size="sm" onClick={handleMarkSent} disabled={!!loading}>
              {loading === 'sent' ? 'Updating...' : 'Mark as Sent'}
            </Button>
          </div>
        </div>
      ) : status === 'quote_sent' ? (
        <div>
          <p className="text-sm text-slate-700 mb-1">
            Renewal quote <strong>{renewalState?.renewalQuoteNumber}</strong> sent to customer.
          </p>
          <p className="text-xs text-slate-400 mb-4">Status: Sent — awaiting acceptance.</p>
          <div className="flex items-center gap-2">
            {renewalState?.renewalQuoteId && (
              <Link href={`/quotes/${renewalState.renewalQuoteId}`}>
                <Button variant="blue" size="sm">View Renewal Quote</Button>
              </Link>
            )}
            <Button variant="success" size="sm" onClick={handleMarkAccepted} disabled={!!loading}>
              {loading === 'accepted' ? 'Updating...' : 'Mark as Accepted'}
            </Button>
          </div>
        </div>
      ) : status === 'quote_accepted' ? (
        <div>
          <p className="text-sm text-slate-700 mb-4">
            Renewal quote accepted. Ready to create the new contract.
          </p>
          <Button variant="success" size="sm" onClick={() => setShowTermModal(true)} disabled={!!loading}>
            Complete Renewal & Create Contract
          </Button>
        </div>
      ) : status === 'completed' ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 text-lg">&#10003;</span>
            <span className="font-semibold text-green-800">Renewal complete.</span>
          </div>
          {renewalState?.newContractId && (
            <Link href={`/contracts/${renewalState.newContractId}`}>
              <Button variant="primary" size="sm">View New Contract</Button>
            </Link>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Status: {status}</p>
      )}

      {/* Term selection modal */}
      {showTermModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirm New Term</h3>
            <p className="text-sm text-slate-500 mb-4">
              Select the term length for the new contract.
            </p>
            <select
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4 focus:border-indigo-400 focus:outline-none"
            >
              {TERM_MONTH_OPTIONS.map(opt => (
                <option key={opt.value ?? 'open'} value={opt.value ?? 'open'}>
                  {opt.label}
                </option>
              ))}
              <option value="open">Open-ended</option>
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="default" size="sm" onClick={() => setShowTermModal(false)}>
                Cancel
              </Button>
              <Button variant="success" size="sm" onClick={handleComplete} disabled={loading === 'complete'}>
                {loading === 'complete' ? 'Creating...' : 'Create Contract'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
