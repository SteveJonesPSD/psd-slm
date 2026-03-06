'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Badge, CONTRACT_CATEGORY_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createContractType, updateContractType, getActiveContractCountForType } from '../../contracts/actions'
import type { ContractType } from '@/lib/contracts/types'
import { CONTRACT_CATEGORIES, VISIT_FREQUENCIES } from '@/lib/contracts/types'

interface ContractTypesManagerProps {
  types: ContractType[]
}

export function ContractTypesManager({ types }: ContractTypesManagerProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState<ContractType | null>(null)

  const handleToggleActive = async (type: ContractType) => {
    if (type.is_active) {
      const count = await getActiveContractCountForType(type.id)
      if (count > 0) {
        alert(`Cannot deactivate: ${count} active contract(s) use this type.`)
        return
      }
    }
    const fd = new FormData()
    fd.append('is_active', String(!type.is_active))
    await updateContractType(type.id, fd)
    router.refresh()
  }

  return (
    <div>
      <PageHeader
        title="Contract Types"
        subtitle="Manage service contract templates"
        actions={
          <Button
            variant="primary"
            onClick={() => { setEditingType(null); setShowModal(true) }}
          >
            + New Contract Type
          </Button>
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Frequency</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Visits/Yr</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Hours</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Support</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Active</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase" />
              </tr>
            </thead>
            <tbody>
              {types.map((t) => {
                const catCfg = CONTRACT_CATEGORY_CONFIG[t.category]
                return (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{t.code}</td>
                    <td className="px-4 py-3">
                      {catCfg && <Badge label={catCfg.label} color={catCfg.color} bg={catCfg.bg} />}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.default_visit_frequency ? t.default_visit_frequency.charAt(0).toUpperCase() + t.default_visit_frequency.slice(1) : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-center">{t.default_visits_per_year ?? '\u2014'}</td>
                    <td className="px-4 py-3 text-center">{t.default_visit_length_hours ?? '\u2014'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        {t.includes_remote_support && (
                          <span className="inline-block rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700" title="Remote Support">R</span>
                        )}
                        {t.includes_telephone && (
                          <span className="inline-block rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700" title="Telephone">T</span>
                        )}
                        {t.includes_onsite && (
                          <span className="inline-block rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700" title="Onsite">O</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(t)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          t.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            t.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                          style={{ transform: t.is_active ? 'translateX(18px)' : 'translateX(2px)' }}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setEditingType(t); setShowModal(true) }}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
              {types.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                    No contract types yet. Click &quot;+ New Contract Type&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ContractTypeModal
          type={editingType}
          onClose={() => { setShowModal(false); setEditingType(null) }}
          onSaved={() => { setShowModal(false); setEditingType(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function ContractTypeModal({
  type,
  onClose,
  onSaved,
}: {
  type: ContractType | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!type
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: type?.name || '',
    code: type?.code || '',
    description: type?.description || '',
    category: type?.category || 'ict',
    default_visit_frequency: type?.default_visit_frequency || '',
    default_visit_length_hours: type?.default_visit_length_hours ? String(type.default_visit_length_hours) : '',
    default_visits_per_year: type?.default_visits_per_year ? String(type.default_visits_per_year) : '',
    includes_remote_support: type?.includes_remote_support ?? false,
    includes_telephone: type?.includes_telephone ?? false,
    includes_onsite: type?.includes_onsite ?? false,
    sort_order: type?.sort_order ? String(type.sort_order) : '0',
  })

  const upd = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const autoCode = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError('Name and code are required')
      return
    }
    setSaving(true)
    setError('')

    const fd = new FormData()
    fd.append('name', form.name.trim())
    fd.append('code', form.code.trim().toLowerCase())
    fd.append('description', form.description)
    fd.append('category', form.category)
    fd.append('default_visit_frequency', form.default_visit_frequency)
    fd.append('default_visit_length_hours', form.default_visit_length_hours)
    fd.append('default_visits_per_year', form.default_visits_per_year)
    fd.append('includes_remote_support', String(form.includes_remote_support))
    fd.append('includes_telephone', String(form.includes_telephone))
    fd.append('includes_onsite', String(form.includes_onsite))
    fd.append('sort_order', form.sort_order)

    const result = isEdit
      ? await updateContractType(type!.id, fd)
      : await createContractType(fd)

    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {isEdit ? 'Edit Contract Type' : 'New Contract Type'}
        </h3>

        {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value
                  setForm((f) => ({
                    ...f,
                    name,
                    code: isEdit ? f.code : autoCode(name),
                  }))
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={upd('code')}
                disabled={isEdit}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={upd('description')} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={upd('category')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                {CONTRACT_CATEGORIES.map((c) => {
                  const cfg = CONTRACT_CATEGORY_CONFIG[c]
                  return <option key={c} value={c}>{cfg?.label || c}</option>
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
              <input type="number" min="0" value={form.sort_order} onChange={upd('sort_order')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Frequency</label>
              <select value={form.default_visit_frequency} onChange={upd('default_visit_frequency')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                <option value="">None</option>
                {VISIT_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Visit Hours</label>
              <input type="number" step="0.5" min="0" value={form.default_visit_length_hours} onChange={upd('default_visit_length_hours')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Visits/Year</label>
              <input type="number" min="0" value={form.default_visits_per_year} onChange={upd('default_visits_per_year')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Support Includes</label>
            <div className="flex flex-wrap gap-4">
              {[
                { key: 'includes_remote_support', label: 'Remote Support' },
                { key: 'includes_telephone', label: 'Telephone' },
                { key: 'includes_onsite', label: 'Onsite' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}
