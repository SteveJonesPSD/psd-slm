'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
import { createContract } from '../../actions'

interface ContractFormProps {
  customers: { id: string; name: string }[]
  slaPlans: { id: string; name: string }[]
  contractTypes: { id: string; name: string }[]
}

export function ContractForm({ customers, slaPlans, contractTypes }: ContractFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    customer_id: '',
    sla_plan_id: '',
    contract_number: '',
    contract_type_id: '',
    monthly_hours: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
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
        contract_number: form.contract_number,
        contract_type_id: form.contract_type_id,
        monthly_hours: form.monthly_hours ? parseFloat(form.monthly_hours) : undefined,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
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

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 p-6 space-y-6">
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
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contract Number *</label>
            <input
              type="text"
              value={form.contract_number}
              onChange={e => setForm({ ...form, contract_number: e.target.value })}
              required
              placeholder="e.g. SC-CUST-001"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchableSelect
            label="Contract Type"
            required
            value={form.contract_type_id}
            options={contractTypes.map(ct => ({ value: ct.id, label: ct.name }))}
            placeholder="Select type..."
            onChange={val => setForm({ ...form, contract_type_id: val })}
          />
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
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Monthly Hours</label>
            <input
              type="number"
              value={form.monthly_hours}
              onChange={e => setForm({ ...form, monthly_hours: e.target.value })}
              step="0.5"
              placeholder="e.g. 10"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Start Date *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
              required
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">End Date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={e => setForm({ ...form, end_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          onClick={() => router.push('/helpdesk/contracts')}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={saving || !form.customer_id || !form.contract_number.trim() || !form.contract_type_id || !form.start_date}
        >
          {saving ? 'Creating...' : 'Create Contract'}
        </Button>
      </div>
    </form>
  )
}
