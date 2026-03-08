'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ContractsTable } from './contracts-table'
import { InvoicingTab } from './invoicing-tab'
import type { CustomerContractWithDetails } from '@/lib/contracts/types'
import type { SupportContractInvoicingRow } from './actions'

interface ContractsPageTabsProps {
  activeTab: string
  contracts: CustomerContractWithDetails[]
  invoicingData: SupportContractInvoicingRow[] | null
  showInvoicingTab: boolean
}

const TAB_ITEMS = [
  { key: 'all', label: 'All' },
  { key: 'support', label: 'Support' },
  { key: 'service', label: 'Service' },
  { key: 'licensing', label: 'Licensing' },
]

export function ContractsPageTabs({ activeTab, contracts, invoicingData, showInvoicingTab }: ContractsPageTabsProps) {
  const router = useRouter()
  const pathname = usePathname()

  const tabs = [
    ...TAB_ITEMS,
    ...(showInvoicingTab ? [{ key: 'invoicing', label: 'Invoicing' }] : []),
  ]

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('tab', tab)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  // Filter contracts by category tab
  const filteredContracts = activeTab === 'all' || activeTab === 'invoicing'
    ? contracts
    : contracts.filter(c => c.category === activeTab)

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-8">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
            {tab.key === 'invoicing' && invoicingData && (
              <span className="ml-1.5 text-xs text-slate-400">
                ({invoicingData.filter(c => c.invoice_due).length} due)
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'invoicing' && invoicingData ? (
        <InvoicingTab contracts={invoicingData} />
      ) : (
        <ContractsTable contracts={filteredContracts} />
      )}
    </div>
  )
}
