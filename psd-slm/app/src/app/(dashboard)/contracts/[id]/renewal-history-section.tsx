'use client'

import Link from 'next/link'
import type { ContractRenewal } from '@/lib/contracts/types'
import { formatCurrency } from '@/lib/utils'

interface RenewalHistorySectionProps {
  renewals: ContractRenewal[]
  currentContractId: string
}

const METHOD_LABELS: Record<string, string> = {
  auto: 'Auto',
  manual: 'Manual',
  esign: 'E-Sign',
  bulk: 'Bulk',
}

export function RenewalHistorySection({ renewals, currentContractId }: RenewalHistorySectionProps) {
  if (renewals.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <h3 className="text-[15px] font-semibold mb-4">Renewal History</h3>

      <div className="overflow-x-auto">
        <table className="min-w-[600px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2 pr-3">Previous Period</th>
              <th className="pb-2 pr-3">New Period</th>
              <th className="pb-2 pr-3 text-right">Value Change</th>
              <th className="pb-2 pr-3">Method</th>
              <th className="pb-2 pr-3">Renewed By</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {renewals.map((r) => {
              const prevVal = Number(r.previous_annual_value) || 0
              const newVal = Number(r.new_annual_value) || 0
              const diff = newVal - prevVal
              const linkedId = r.old_contract_id === currentContractId ? r.new_contract_id : r.old_contract_id

              return (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {new Date(r.previous_end_date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {new Date(r.new_start_date).toLocaleDateString('en-GB')} &ndash; {new Date(r.new_end_date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {formatCurrency(prevVal)} &rarr; {formatCurrency(newVal)}
                    {diff !== 0 && (
                      <span className={`ml-1 text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({diff > 0 ? '+' : ''}{formatCurrency(diff)})
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {METHOD_LABELS[r.renewal_method] || r.renewal_method}
                    </span>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.renewed_by_name || '\u2014'}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <Link
                      href={`/contracts/${linkedId}`}
                      className="text-xs text-indigo-600 hover:text-indigo-800 no-underline"
                    >
                      View {r.old_contract_id === currentContractId ? 'New' : 'Previous'}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
