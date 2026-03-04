'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addEntitlement, updateEntitlement, deleteEntitlement } from '../actions'
import type { ContractEntitlement } from '@/lib/contracts/types'

interface ContractEntitlementsSectionProps {
  contractId: string
  entitlements: ContractEntitlement[]
  includesRemote: boolean
  includesTelephone: boolean
  includesOnsite: boolean
  editable: boolean
}

export function ContractEntitlementsSection({
  contractId,
  entitlements,
  includesRemote,
  includesTelephone,
  includesOnsite,
  editable,
}: ContractEntitlementsSectionProps) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)

  const inherited = [
    { label: 'Remote Support', included: includesRemote },
    { label: 'Telephone Support', included: includesTelephone },
    { label: 'Onsite Support', included: includesOnsite },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Entitlements</h3>
        {editable && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {/* Inherited from contract type */}
      <div className="mb-3">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">From Contract Type</div>
        <div className="flex flex-wrap gap-2">
          {inherited.map((e) => (
            <span
              key={e.label}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                e.included
                  ? 'bg-green-50 text-green-700'
                  : 'bg-slate-100 text-slate-400 line-through'
              }`}
            >
              {e.included ? '✓' : '✗'} {e.label}
            </span>
          ))}
        </div>
      </div>

      {/* Custom entitlements */}
      {entitlements.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Custom Entitlements</div>
          <div className="space-y-1.5">
            {entitlements.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-sm ${
                      e.is_included ? 'text-green-700' : 'text-slate-400 line-through'
                    }`}
                  >
                    {e.is_included ? '✓' : '✗'} {e.entitlement_type}
                    {e.description && (
                      <span className="text-xs text-slate-400 ml-1">— {e.description}</span>
                    )}
                  </span>
                </div>
                {editable && (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const fd = new FormData()
                        fd.append('is_included', String(!e.is_included))
                        await updateEntitlement(e.id, contractId, fd)
                        router.refresh()
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      {e.is_included ? 'Exclude' : 'Include'}
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Delete this entitlement?')) {
                          await deleteEntitlement(e.id, contractId)
                          router.refresh()
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {entitlements.length === 0 && !includesRemote && !includesTelephone && !includesOnsite && (
        <p className="text-sm text-slate-400">No entitlements configured.</p>
      )}

      {/* Add entitlement modal */}
      {showAdd && (
        <EntitlementModal
          contractId={contractId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); router.refresh() }}
        />
      )}
    </div>
  )
}

function EntitlementModal({
  contractId,
  onClose,
  onSaved,
}: {
  contractId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')

  const handleSave = async () => {
    if (!type.trim()) return
    setSaving(true)
    const fd = new FormData()
    fd.append('entitlement_type', type.trim())
    if (description) fd.append('description', description)
    fd.append('is_included', 'true')
    await addEntitlement(contractId, fd)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Entitlement</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g. Priority Response"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !type.trim()} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
