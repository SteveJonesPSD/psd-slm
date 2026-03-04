'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CONTRACT_TYPE_CONFIG } from '@/components/ui/badge'

interface ContractRow {
  id: string
  name: string
  contract_type: string
  monthly_hours: number | null
  start_date: string
  end_date: string | null
  is_active: boolean
  customers?: { id: string; name: string } | null
  sla_plans?: { id: string; name: string } | null
}

export function ContractsTable({ data }: { data: ContractRow[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Name</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Customer</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Type</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">SLA Plan</th>
            <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">Monthly Hours</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Dates</th>
            <th className="px-4 py-3 text-center font-medium text-slate-500 whitespace-nowrap">Active</th>
          </tr>
        </thead>
        <tbody>
          {data.map(c => {
            const typeConfig = CONTRACT_TYPE_CONFIG[c.contract_type]
            return (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <Link href={`/helpdesk/contracts/${c.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 no-underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{c.customers?.name || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {typeConfig && <Badge label={typeConfig.label} color={typeConfig.color} bg={typeConfig.bg} />}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{c.sla_plans?.name || '—'}</td>
                <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                  {c.monthly_hours ? `${c.monthly_hours}h` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {new Date(c.start_date).toLocaleDateString('en-GB')}
                  {c.end_date ? ` – ${new Date(c.end_date).toLocaleDateString('en-GB')}` : ' – Ongoing'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                </td>
              </tr>
            )
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                No support contracts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
