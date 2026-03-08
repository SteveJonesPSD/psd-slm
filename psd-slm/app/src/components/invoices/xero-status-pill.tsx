'use client'

import { useState } from 'react'

interface XeroStatusPillProps {
  xeroStatus: string | null
  xeroPushedAt: string | null
  xeroInvoiceId: string | null
  xeroError: string | null
}

const STATUS_CONFIG: Record<string, { bg: string; dot: string; label: string }> = {
  pending: {
    bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500 animate-pulse',
    label: 'Syncing\u2026',
  },
  synced: {
    bg: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    dot: 'bg-green-500',
    label: 'Xero \u2713',
  },
  failed: {
    bg: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    dot: 'bg-red-500',
    label: 'Xero \u2717',
  },
}

export function XeroStatusPill({
  xeroStatus,
  xeroPushedAt,
  xeroInvoiceId,
  xeroError,
}: XeroStatusPillProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!xeroStatus) return null

  const config = STATUS_CONFIG[xeroStatus] ?? {
    bg: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    label: xeroStatus,
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="relative inline-block">
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border cursor-default ${config.bg}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
        {config.label}
      </span>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
          <div className="space-y-1.5">
            {xeroPushedAt && (
              <div>
                <span className="text-gray-400">Last pushed: </span>
                {formatDate(xeroPushedAt)}
              </div>
            )}
            {xeroInvoiceId && (
              <div>
                <span className="text-gray-400">Xero ID: </span>
                <span className="font-mono">{xeroInvoiceId.slice(0, 8)}\u2026</span>
              </div>
            )}
            {xeroError && (
              <div className="text-red-300 border-t border-gray-700 pt-1.5 mt-1.5">
                <span className="text-gray-400">Error: </span>
                {xeroError.slice(0, 200)}
              </div>
            )}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
