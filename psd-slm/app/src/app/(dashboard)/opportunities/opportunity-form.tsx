'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Select, Textarea, SearchableSelect } from '@/components/ui/form-fields'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Button } from '@/components/ui/button'
import { OPPORTUNITY_STAGE_CONFIG, ACTIVE_STAGES, type OpportunityStage } from '@/lib/opportunities'
import { createOpportunity, updateOpportunity } from '@/app/(dashboard)/pipeline/actions'
import type { Opportunity, Customer, Contact, User } from '@/types/database'

interface OpportunityFormProps {
  opportunity?: Opportunity
  customers: Pick<Customer, 'id' | 'name'>[]
  contacts: Pick<Contact, 'id' | 'customer_id' | 'first_name' | 'last_name'>[]
  users: Pick<User, 'id' | 'first_name' | 'last_name'>[]
  defaultCustomerId?: string
  currentUserId?: string
}

export function OpportunityForm({
  opportunity,
  customers,
  contacts,
  users,
  defaultCustomerId,
  currentUserId,
}: OpportunityFormProps) {
  const router = useRouter()
  const isEdit = !!opportunity

  const [form, setForm] = useState({
    title: opportunity?.title || '',
    customer_id: opportunity?.customer_id || defaultCustomerId || '',
    contact_id: opportunity?.contact_id || '',
    assigned_to: opportunity?.assigned_to || currentUserId || '',
    stage: opportunity?.stage || 'prospecting',
    estimated_value: opportunity?.estimated_value ?? null,
    probability: opportunity?.probability ?? OPPORTUNITY_STAGE_CONFIG.prospecting.defaultProbability,
    expected_close_date: opportunity?.expected_close_date || '',
    notes: opportunity?.notes || '',
  })

  const [probManuallyEdited, setProbManuallyEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upd = <K extends keyof typeof form>(key: K) => (value: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleStageChange = (stage: string) => {
    const validStage = stage as OpportunityStage
    setForm((f) => ({
      ...f,
      stage: validStage,
      ...(probManuallyEdited
        ? {}
        : { probability: OPPORTUNITY_STAGE_CONFIG[validStage]?.defaultProbability ?? f.probability }),
    }))
  }

  const handleProbabilityChange = (val: string) => {
    setProbManuallyEdited(true)
    setForm((f) => ({ ...f, probability: Number(val) || 0 }))
  }

  // Filter contacts by selected customer
  const filteredContacts = contacts.filter((c) => c.customer_id === form.customer_id)

  const handleSubmit = async () => {
    setSaving(true)
    setError('')

    const fd = new FormData()
    fd.set('title', form.title)
    fd.set('customer_id', form.customer_id)
    fd.set('contact_id', form.contact_id)
    fd.set('assigned_to', form.assigned_to)
    fd.set('stage', form.stage)
    if (form.estimated_value !== null) fd.set('estimated_value', String(form.estimated_value))
    fd.set('probability', String(form.probability))
    fd.set('expected_close_date', form.expected_close_date)
    fd.set('notes', form.notes)

    const result = isEdit
      ? await updateOpportunity(opportunity.id, fd)
      : await createOpportunity(fd)

    if ('error' in result && result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    if (!isEdit && 'data' in result && result.data) {
      router.push(`/opportunities/${result.data.id}`)
    } else {
      router.push(`/opportunities/${opportunity?.id}`)
    }
    router.refresh()
  }

  // Reset contact when customer changes
  const handleCustomerChange = (val: string) => {
    setForm((f) => ({ ...f, customer_id: val, contact_id: '' }))
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-2xl">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Input
          label="Title *"
          value={form.title}
          onChange={upd('title')}
          placeholder="e.g. Network Refresh — Acme Corp"
          className="col-span-2"
        />

        <SearchableSelect
          label="Company"
          required
          value={form.customer_id}
          options={customers.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Search companies..."
          onChange={handleCustomerChange}
        />

        <SearchableSelect
          label="Contact"
          value={form.contact_id}
          options={filteredContacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
          placeholder={filteredContacts.length === 0 ? 'No contacts' : 'Search contacts...'}
          onChange={upd('contact_id')}
          disabled={filteredContacts.length === 0}
        />

        <Select
          label="Stage"
          value={form.stage}
          onChange={handleStageChange}
          options={ACTIVE_STAGES.map((s) => ({
            value: s,
            label: OPPORTUNITY_STAGE_CONFIG[s].label,
          }))}
        />

        <SearchableSelect
          label="Assigned To"
          value={form.assigned_to}
          options={users.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
          placeholder="Search users..."
          onChange={upd('assigned_to')}
        />

        <CurrencyInput
          label="Estimated Value"
          value={form.estimated_value}
          onChange={(v) => setForm((f) => ({ ...f, estimated_value: v }))}
        />

        <Input
          label="Probability (%)"
          type="number"
          min="0"
          max="100"
          value={String(form.probability)}
          onChange={handleProbabilityChange}
        />

        <Input
          label="Expected Close Date"
          type="date"
          value={form.expected_close_date}
          onChange={upd('expected_close_date')}
        />
      </div>

      <Textarea
        label="Notes"
        value={form.notes}
        onChange={upd('notes')}
        placeholder="Additional context..."
        rows={3}
        className="mb-6"
      />

      <div className="flex gap-2">
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Opportunity'}
        </Button>
        <Button onClick={() => router.back()}>Cancel</Button>
      </div>
    </div>
  )
}
