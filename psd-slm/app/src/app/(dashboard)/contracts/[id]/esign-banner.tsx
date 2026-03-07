'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signContract, waiveEsign } from '../actions'
import type { EsignStatus } from '@/lib/contracts/types'

interface EsignBannerProps {
  contractId: string
  contractNumber: string
  esignStatus: EsignStatus
  isAdmin: boolean
}

export function EsignBanner({ contractId, contractNumber, esignStatus, isAdmin }: EsignBannerProps) {
  const router = useRouter()
  const [loading, setLoading] = useState('')

  if (esignStatus === 'not_required') return null

  if (esignStatus === 'signed') {
    return (
      <div className="mb-8 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          E-Signed &#10003;
        </span>
        <span className="text-sm text-green-700">This contract has been electronically signed.</span>
      </div>
    )
  }

  if (esignStatus === 'waived') {
    return (
      <div className="mb-8 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-600">
          E-Sign Waived
        </span>
        <span className="text-sm text-slate-500">E-signature requirement was waived by an administrator.</span>
      </div>
    )
  }

  // pending
  const handleSign = async () => {
    setLoading('sign')
    const result = await signContract(contractId)
    setLoading('')
    if (result.error) alert(result.error)
    else router.refresh()
  }

  const handleWaive = async () => {
    if (!confirm(`Waive e-signature requirement for ${contractNumber}? This will activate the contract without a signature.`)) return
    setLoading('waive')
    const result = await waiveEsign(contractId)
    setLoading('')
    if (result.error) alert(result.error)
    else router.refresh()
  }

  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-lg">&#128221;</span>
        <span className="text-sm font-medium text-blue-800">
          Awaiting e-signature to activate this contract
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="success"
          size="sm"
          onClick={handleSign}
          disabled={!!loading}
        >
          {loading === 'sign' ? 'Signing...' : 'Mark as Signed'}
        </Button>
        {isAdmin && (
          <Button
            variant="default"
            size="sm"
            onClick={handleWaive}
            disabled={!!loading}
          >
            {loading === 'waive' ? 'Waiving...' : 'Waive (Admin)'}
          </Button>
        )}
      </div>
    </div>
  )
}
