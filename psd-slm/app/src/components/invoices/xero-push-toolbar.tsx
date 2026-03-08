'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { pushInvoicesBatch } from '@/lib/xero/xero-actions'

interface XeroPushToolbarProps {
  selectedIds: string[]
  onComplete: () => void
  onClear: () => void
}

export function XeroPushToolbar({ selectedIds, onComplete, onClear }: XeroPushToolbarProps) {
  const [pushing, setPushing] = useState(false)
  const [result, setResult] = useState<{ successCount: number; failCount: number } | null>(null)

  if (selectedIds.length === 0) return null

  const handlePush = async () => {
    setPushing(true)
    setResult(null)
    try {
      const res = await pushInvoicesBatch(selectedIds)
      setResult({ successCount: res.successCount, failCount: res.failCount })
      setTimeout(() => {
        setResult(null)
        onComplete()
      }, 3000)
    } catch (err) {
      setResult({ successCount: 0, failCount: selectedIds.length })
      console.error('[XeroPushToolbar]', err)
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
      <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
        {selectedIds.length} invoice{selectedIds.length !== 1 ? 's' : ''} selected
      </span>

      <Button
        size="sm"
        variant="primary"
        onClick={handlePush}
        disabled={pushing}
      >
        {pushing ? (
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Pushing\u2026
          </span>
        ) : (
          'Push to Xero'
        )}
      </Button>

      <button
        onClick={onClear}
        className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
      >
        Clear selection
      </button>

      {result && (
        <span className={`text-sm font-medium ${
          result.failCount === 0
            ? 'text-green-700 dark:text-green-400'
            : 'text-red-700 dark:text-red-400'
        }`}>
          {result.failCount === 0
            ? `${result.successCount} pushed successfully`
            : `${result.successCount} pushed, ${result.failCount} failed`
          }
        </span>
      )}
    </div>
  )
}
