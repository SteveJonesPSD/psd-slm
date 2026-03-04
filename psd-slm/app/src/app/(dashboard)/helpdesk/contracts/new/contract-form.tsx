'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/ui/form-fields'
import { createContract } from '../../actions'

interface ContractFormProps {
  customers: { id: string; name: string }[]
  slaPlans: { id: string; name: string }[]
}

export function ContractForm({ customers, slaPlans }: ContractFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    customer_id: '',
    sla_plan_id: '',
    name: '',
    contract_type: 'helpdesk',
    monthly_hours: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    onsite_engineer: '',
    onsite_schedule: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const result = await createContract({
        customer_id: form.customer_id,
        sla_plan_id: form.sla_plan_id || undefined,
        name: form.name,
        contract_type: form.contract_type,
        monthly_hours: form.monthly_hours ? parseFloat(form.monthly_hours) : undefined,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        onsite_engineer: form.onsite_engineer || undefined,
        onsite_schedule: form.onsite_schedule || undefined,
        notes: form.notes || undefined,
      })

      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        router.push(`/helpdesk/contracts/${result.data.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const showOnsiteFields = form.contract_type === 'onsite' || form.contract_type === 'both'

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchableSelect
            label="Customer"
            required
            value={form.customer_id}
            options={customers.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Search customers..."
            onChange={val => setForm({ ...form, customer_id: val })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Contract Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. Annual Helpdesk Support"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Contract Type *</label>
            <select
              value={form.contract_type}
              onChange={e => setForm({ ...form, contract_type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="helpdesk">Service Desk</option>
              <option value="onsite">Onsite</option>
              <option value="both">Both</option>
            </select>
          </div>
          <SearchableSelect
            label="SLA Plan"
            value={form.sla_plan_id}
            options={slaPlans.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Search SLA plans..."
            onChange={val => setForm({ ...form, sla_plan_id: val })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Monthly Hours</label>
            <input
              type="number"
              value={form.monthly_hours}
              onChange={e => setForm({ ...form, monthly_hours: e.target.value })}
              step="0.5"
              placeholder="e.g. 10"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start Date *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={e => setForm({ ...form, end_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {showOnsiteFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Onsite Engineer</label>
              <input
                type="text"
                value={form.onsite_engineer}
                onChange={e => setForm({ ...form, onsite_engineer: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Onsite Schedule</label>
              <input
                type="text"
                value={form.onsite_schedule}
                onChange={e => setForm({ ...form, onsite_schedule: e.target.value })}
                placeholder="e.g. Every Tuesday 09:00–17:00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/helpdesk/contracts')}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.customer_id || !form.name.trim() || !form.start_date}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Contract'}
        </button>
      </div>
    </form>
  )
}
