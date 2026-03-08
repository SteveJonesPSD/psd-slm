'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { pushInvoicesBatch } from '@/lib/xero/xero-actions'

interface InvoiceXeroActionsProps {
  invoiceId: string
  xeroStatus: string | null
}

export function InvoiceXeroActions({ invoiceId, xeroStatus }: InvoiceXeroActionsProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [pushing, setPushing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const canPush = ['super_admin', 'admin', 'finance'].includes(user?.role?.name ?? '')
  if (!canPush) return null

  const showPush = !xeroStatus || xeroStatus === 'failed'
  if (!showPush && xeroStatus !== 'pending') return null

  const handlePush = async () => {
    setPushing(true)
    setResult(null)
    try {
      const res = await pushInvoicesBatch([invoiceId])
      if (res.failCount > 0) {
        setResult(res.results[0]?.error ?? 'Push failed')
      } else {
        setResult('Pushed to Xero')
      }
      setTimeout(() => {
        setResult(null)
        router.refresh()
      }, 2000)
    } catch (err) {
      setResult(String(err))
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {xeroStatus === 'pending' && (
        <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Syncing to Xero...
        </span>
      )}
      {showPush && (
        <Button
          size="sm"
          variant="primary"
          onClick={handlePush}
          disabled={pushing}
        >
          {pushing ? 'Pushing\u2026' : xeroStatus === 'failed' ? 'Retry Xero Push' : 'Push to Xero'}
        </Button>
      )}
      {result && (
        <span className={`text-xs font-medium ${
          result === 'Pushed to Xero' ? 'text-green-600' : 'text-red-600'
        }`}>
          {result}
        </span>
      )}
    </div>
  )
}
