'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCustomerContract } from '../actions'
import type { CustomerContractWithDetails } from '@/lib/contracts/types'
import { VISIT_FREQUENCIES } from '@/lib/contracts/types'

interface VisitOverridesSectionProps {
  contract: CustomerContractWithDetails
  editable: boolean
}

export function VisitOverridesSection({ contract, editable }: VisitOverridesSectionProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Get the contract type defaults from the joined data
  const ctDefaults = {
    frequency: contract.effective_frequency && !contract.visit_frequency
      ? contract.effective_frequency
      : null,
    visitHours: contract.effective_visit_hours && !contract.visit_length_hours
      ? contract.effective_visit_hours
      : null,
    visitsPerYear: contract.effective_visits_per_year && !contract.visits_per_year
      ? contract.effective_visits_per_year
      : null,
  }

  const handleUpdate = async (field: string, value: string | null) => {
    setSaving(true)
    const fd = new FormData()
    fd.append(field, value || '')
    await updateCustomerContract(contract.id, fd)
    setSaving(false)
    router.refresh()
  }

  const formatFrequency = (f: string | null) => f ? f.charAt(0).toUpperCase() + f.slice(1) : '\u2014'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <h3 className="text-[15px] font-semibold mb-3">Visit Schedule</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Frequency */}
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Visit Frequency</div>
          {editable ? (
            <div className="flex items-center gap-2">
              <select
                value={contract.visit_frequency || ''}
                onChange={(e) => handleUpdate('visit_frequency', e.target.value || null)}
                disabled={saving}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              >
                <option value="">
                  {ctDefaults.frequency ? `Inherit (${formatFrequency(ctDefaults.frequency)})` : 'Not set'}
                </option>
                {VISIT_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{formatFrequency(f)}</option>
                ))}
              </select>
              {contract.visit_frequency && (
                <button
                  onClick={() => handleUpdate('visit_frequency', null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                  title="Clear override"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-700">{formatFrequency(contract.effective_frequency)}</div>
          )}
          <div className="text-xs text-slate-400 mt-1">
            Effective: <span className="font-medium">{formatFrequency(contract.effective_frequency)}</span>
            {contract.visit_frequency
              ? <span className="text-amber-600 ml-1">(overridden)</span>
              : ctDefaults.frequency
                ? <span className="text-slate-400 ml-1">(from {contract.contract_type_name})</span>
                : null}
          </div>
        </div>

        {/* Visit Length */}
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Visit Length (hours)</div>
          {editable ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                value={contract.visit_length_hours ?? ''}
                onChange={(e) => handleUpdate('visit_length_hours', e.target.value || null)}
                placeholder={ctDefaults.visitHours ? `Inherit (${ctDefaults.visitHours})` : 'Not set'}
                disabled={saving}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              {contract.visit_length_hours && (
                <button
                  onClick={() => handleUpdate('visit_length_hours', null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                  title="Clear override"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-700">{contract.effective_visit_hours ?? '\u2014'}</div>
          )}
          <div className="text-xs text-slate-400 mt-1">
            Effective: <span className="font-medium">{contract.effective_visit_hours ?? '\u2014'}h</span>
            {contract.visit_length_hours
              ? <span className="text-amber-600 ml-1">(overridden)</span>
              : ctDefaults.visitHours
                ? <span className="text-slate-400 ml-1">(from {contract.contract_type_name})</span>
                : null}
          </div>
        </div>

        {/* Visits Per Year */}
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Visits Per Year</div>
          {editable ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={contract.visits_per_year ?? ''}
                onChange={(e) => handleUpdate('visits_per_year', e.target.value || null)}
                placeholder={ctDefaults.visitsPerYear ? `Inherit (${ctDefaults.visitsPerYear})` : 'Not set'}
                disabled={saving}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              {contract.visits_per_year && (
                <button
                  onClick={() => handleUpdate('visits_per_year', null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                  title="Clear override"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-700">{contract.effective_visits_per_year ?? '\u2014'}</div>
          )}
          <div className="text-xs text-slate-400 mt-1">
            Effective: <span className="font-medium">{contract.effective_visits_per_year ?? '\u2014'}</span>
            {contract.visits_per_year
              ? <span className="text-amber-600 ml-1">(overridden)</span>
              : ctDefaults.visitsPerYear
                ? <span className="text-slate-400 ml-1">(from {contract.contract_type_name})</span>
                : null}
          </div>
        </div>
      </div>
    </div>
  )
}
