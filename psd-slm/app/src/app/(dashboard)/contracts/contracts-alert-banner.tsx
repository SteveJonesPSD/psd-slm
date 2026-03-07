'use client'

import { useState } from 'react'
import type { ContractAlerts } from './actions'

interface AlertBannerProps {
  alerts: ContractAlerts
}

interface AlertRow {
  key: string
  color: 'red' | 'amber' | 'blue'
  message: string
  count: number
}

const COLOR_MAP = {
  red: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800', dismiss: 'text-red-400 hover:text-red-600' },
  amber: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', dismiss: 'text-amber-400 hover:text-amber-600' },
  blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-800', dismiss: 'text-blue-400 hover:text-blue-600' },
}

export function ContractAlertBanner({ alerts }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const rows: AlertRow[] = []

  if (alerts.expiring90 > 0) {
    rows.push({ key: 'exp90', color: 'red', count: alerts.expiring90, message: `${alerts.expiring90} contract(s) expire within 90 days — action required` })
  }
  if (alerts.pendingInvoices > 0) {
    rows.push({ key: 'inv', color: 'amber', count: alerts.pendingInvoices, message: `${alerts.pendingInvoices} invoice(s) are due for generation — click 'Process Pending Invoices' or review below` })
  }
  if (alerts.expiring180 > 0) {
    rows.push({ key: 'exp180', color: 'amber', count: alerts.expiring180, message: `${alerts.expiring180} contract(s) expire within 6 months — consider renewal` })
  }
  if (alerts.esignPending > 0) {
    rows.push({ key: 'esign', color: 'blue', count: alerts.esignPending, message: `${alerts.esignPending} contract(s) are awaiting e-signature to activate` })
  }

  const visible = rows.filter(r => !dismissed.has(r.key))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-8">
      {visible.map(row => {
        const c = COLOR_MAP[row.color]
        return (
          <div key={row.key} className={`flex items-center justify-between rounded-lg border ${c.border} ${c.bg} px-4 py-2.5`}>
            <span className={`text-sm font-medium ${c.text}`}>{row.message}</span>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, row.key]))}
              className={`ml-3 text-lg leading-none ${c.dismiss}`}
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        )
      })}
    </div>
  )
}
