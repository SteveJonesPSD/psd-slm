'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import { createJob, updateJob, getContactsForCompany, getSalesOrdersForCompany, type CreateJobInput } from './actions'
import { DateRangePicker } from './date-range-picker'

interface Company {
  id: string
  name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  job_title: string | null
  phone: string | null
  email: string | null
  mobile: string | null
}

interface JobTypeOption {
  id: string
  name: string
  slug: string
  default_duration_minutes: number
  task_template?: { id: string; name: string } | null
}

interface Engineer {
  id: string
  first_name: string
  last_name: string
  initials: string | null
  color: string | null
}

interface LinkedSo {
  id: string
  so_number: string
  customer_po: string | null
  requires_install: boolean
}

interface JobFormProps {
  companies: Company[]
  jobTypes: JobTypeOption[]
  engineers: Engineer[]
  workingDays?: number[]
  // Pre-fill for edit mode
  initialData?: {
    id: string
    company_id: string
    contact_id: string | null
    title: string
    description: string | null
    job_type_id: string
    priority: string
    assigned_to: string | null
    scheduled_date: string | null
    scheduled_time: string | null
    estimated_duration_minutes: number
    chargeable_type: string | null
    internal_notes: string | null
    site_address_line1: string | null
    site_address_line2: string | null
    site_city: string | null
    site_county: string | null
    site_postcode: string | null
  }
  // Source linking (e.g. from a sales order)
  sourceType?: 'sales_order' | 'ticket' | 'contract'
  sourceId?: string
  sourceRef?: string // e.g. "SO-2026-0001" — displayed as info banner
  // Pre-fill fields from URL params
  prefill?: {
    company_id?: string
    contact_id?: string
    site_address_line1?: string
    site_address_line2?: string
    site_city?: string
    site_postcode?: string
    internal_notes?: string
  }
  // Existing linked SOs (for edit mode)
  initialLinkedSos?: LinkedSo[]
}

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours (Half Day)' },
  { value: 480, label: '8 hours (Full Day)' },
]

export function JobForm({ companies, jobTypes, engineers, workingDays = [1, 2, 3, 4, 5], initialData, sourceType, sourceId, sourceRef, prefill, initialLinkedSos }: JobFormProps) {
  const router = useRouter()
  const isEdit = !!initialData

  const [form, setForm] = useState({
    company_id: initialData?.company_id || prefill?.company_id || '',
    contact_id: initialData?.contact_id || prefill?.contact_id || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    job_type_id: initialData?.job_type_id || '',
    priority: initialData?.priority || 'normal',
    assigned_to: initialData?.assigned_to || '',
    scheduled_date: initialData?.scheduled_date || '',
    scheduled_time: initialData?.scheduled_time?.substring(0, 5) || '',
    estimated_duration_minutes: initialData?.estimated_duration_minutes || 60,
    chargeable_type: initialData?.chargeable_type || 'as_per_so',
    internal_notes: initialData?.internal_notes || prefill?.internal_notes || '',
    site_address_line1: initialData?.site_address_line1 || prefill?.site_address_line1 || '',
    site_address_line2: initialData?.site_address_line2 || prefill?.site_address_line2 || '',
    site_city: initialData?.site_city || prefill?.site_city || '',
    site_county: initialData?.site_county || '',
    site_postcode: initialData?.site_postcode || prefill?.site_postcode || '',
  })

  // Multi-engineer selection (create mode only — edit mode uses single assigned_to)
  const [selectedEngineers, setSelectedEngineers] = useState<Engineer[]>(
    isEdit && initialData?.assigned_to
      ? engineers.filter(e => e.id === initialData.assigned_to)
      : []
  )

  // Multi-day booking via date range picker (create mode only)
  const [selectedDates, setSelectedDates] = useState<string[]>(
    form.scheduled_date ? [form.scheduled_date] : []
  )

  const [contacts, setContacts] = useState<Contact[]>([])
  const [salesOrders, setSalesOrders] = useState<LinkedSo[]>([])
  const [linkedSos, setLinkedSos] = useState<LinkedSo[]>(initialLinkedSos || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load contacts and sales orders when company changes
  const [initialCompanyId] = useState(form.company_id)
  useEffect(() => {
    if (form.company_id) {
      getContactsForCompany(form.company_id).then(result => {
        if ('data' in result) {
          setContacts(result.data || [])
          if (!isEdit && form.company_id !== initialCompanyId) {
            setForm(prev => ({ ...prev, contact_id: '' }))
          }
        }
      })
      getSalesOrdersForCompany(form.company_id).then(result => {
        setSalesOrders(result.data || [])
        // Clear SO links if company changed (unless it's the initial load)
        if (form.company_id !== initialCompanyId) {
          setLinkedSos([])
        }
      })
      // Clear the prefill address lock after the user changes company
      if (addressPrefilled && form.company_id !== initialCompanyId) {
        setAddressPrefilled(false)
      }
    } else {
      setContacts([])
      setSalesOrders([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.company_id, isEdit])

  // Auto-fill site address from company (skip if prefill provided address)
  const hasPrefillAddress = !!(prefill?.site_address_line1 || prefill?.site_city || prefill?.site_postcode)
  const [addressPrefilled, setAddressPrefilled] = useState(hasPrefillAddress)
  useEffect(() => {
    if (isEdit || addressPrefilled) return
    const company = companies.find(c => c.id === form.company_id)
    if (company) {
      setForm(prev => ({
        ...prev,
        site_address_line1: company.address_line1 || '',
        site_address_line2: company.address_line2 || '',
        site_city: company.city || '',
        site_county: company.county || '',
        site_postcode: company.postcode || '',
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.company_id, companies, isEdit, addressPrefilled])

  // Auto-add source SO to linked list when salesOrders load
  useEffect(() => {
    if (sourceType === 'sales_order' && sourceId && salesOrders.length > 0 && linkedSos.length === 0) {
      const so = salesOrders.find(s => s.id === sourceId)
      if (so) {
        setLinkedSos([so])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesOrders])

  // Auto-fill duration from job type
  useEffect(() => {
    if (isEdit) return
    const jt = jobTypes.find(t => t.id === form.job_type_id)
    if (jt) {
      setForm(prev => ({ ...prev, estimated_duration_minutes: jt.default_duration_minutes }))
    }
  }, [form.job_type_id, jobTypes, isEdit])

  // Auto-suggest title
  useEffect(() => {
    if (isEdit) return
    const jt = jobTypes.find(t => t.id === form.job_type_id)
    const company = companies.find(c => c.id === form.company_id)
    if (jt && company) {
      setForm(prev => ({ ...prev, title: `${jt.name} — ${company.name}` }))
    }
  }, [form.job_type_id, form.company_id, jobTypes, companies, isEdit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (form.scheduled_time && !form.scheduled_date) {
        setError('If time is set, date must also be set')
        return
      }

      const input: CreateJobInput = {
        company_id: form.company_id,
        contact_id: form.contact_id || undefined,
        title: form.title,
        description: form.description || undefined,
        job_type_id: form.job_type_id,
        priority: form.priority,
        assigned_to: form.assigned_to || undefined,
        scheduled_date: form.scheduled_date || undefined,
        scheduled_time: form.scheduled_time || undefined,
        estimated_duration_minutes: form.estimated_duration_minutes,
        chargeable_type: form.chargeable_type as CreateJobInput['chargeable_type'],
        internal_notes: form.internal_notes || undefined,
        site_address_line1: form.site_address_line1 || undefined,
        site_address_line2: form.site_address_line2 || undefined,
        site_city: form.site_city || undefined,
        site_county: form.site_county || undefined,
        site_postcode: form.site_postcode || undefined,
        source_type: sourceType || undefined,
        source_id: sourceId || undefined,
        linked_so_ids: linkedSos.map(so => so.id),
      }

      if (isEdit) {
        const result = await updateJob(initialData.id, input)
        if (result.error) {
          setError(result.error)
        } else {
          router.push(`/scheduling/jobs/${initialData.id}`)
        }
      } else {
        // Build the list of dates and engineers to create jobs for
        const dates = selectedDates.length > 0 ? selectedDates : [form.scheduled_date || '']
        const engineerIds = selectedEngineers.length > 0
          ? selectedEngineers.map(e => e.id)
          : [undefined] // single undefined = no engineer assigned

        const totalJobs = dates.filter(Boolean).length * engineerIds.length

        if (totalJobs === 1) {
          // Single job — simple path
          if (engineerIds[0]) input.assigned_to = engineerIds[0]
          if (dates[0]) input.scheduled_date = dates[0]
          const result = await createJob(input)
          if (result.error) {
            setError(result.error)
          } else if (result.data) {
            router.push(`/scheduling/jobs/${result.data.id}`)
          }
        } else {
          // Multiple jobs — date × engineer matrix
          const errors: string[] = []
          let created = 0

          for (const date of dates) {
            for (const engId of engineerIds) {
              const jobInput = { ...input, scheduled_date: date || undefined, assigned_to: engId }
              const result = await createJob(jobInput)
              if (result.error) {
                errors.push(result.error)
              } else {
                created++
              }
            }
          }

          if (errors.length > 0 && created === 0) {
            setError(errors[0])
          } else {
            router.push('/scheduling')
          }
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {sourceRef && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-center gap-2">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Linked to <strong>{sourceRef}</strong>
        </div>
      )}

      {/* Customer & Contact */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Customer</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SearchableSelect
            label="Company"
            required
            value={form.company_id}
            options={companies.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Search companies..."
            onChange={(val) => setForm({ ...form, company_id: val })}
          />
          <SearchableSelect
            label="Contact"
            value={form.contact_id}
            options={contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}${c.email ? ` (${c.email})` : ''}` }))}
            placeholder="Search contacts..."
            onChange={(val) => setForm({ ...form, contact_id: val })}
            disabled={!form.company_id}
          />
        </div>
      </div>

      {/* Site Address */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Site Address</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 1</label>
            <input
              type="text"
              value={form.site_address_line1}
              onChange={e => setForm({ ...form, site_address_line1: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 2</label>
            <input
              type="text"
              value={form.site_address_line2}
              onChange={e => setForm({ ...form, site_address_line2: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
              <input
                type="text"
                value={form.site_city}
                onChange={e => setForm({ ...form, site_city: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">County</label>
              <input
                type="text"
                value={form.site_county}
                onChange={e => setForm({ ...form, site_county: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Postcode</label>
              <input
                type="text"
                value={form.site_postcode}
                onChange={e => setForm({ ...form, site_postcode: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Job Details */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Job Details</h3>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <SearchableSelect
                label="Job Type"
                required
                value={form.job_type_id}
                options={jobTypes.map(t => ({ value: t.id, label: t.name }))}
                placeholder="Search job types..."
                onChange={(val) => setForm({ ...form, job_type_id: val })}
              />
              {(() => {
                const selectedType = jobTypes.find(t => t.id === form.job_type_id)
                return selectedType?.task_template ? (
                  <p className="mt-1.5 text-xs text-indigo-600">
                    Includes checklist: {selectedType.task_template.name}
                  </p>
                ) : null
              })()}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
              placeholder="e.g. Installation — Meridian Academy Trust"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {/* Linked Sales Orders */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Linked Sales Orders</label>
            {linkedSos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {linkedSos.map(so => (
                  <span
                    key={so.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-800"
                  >
                    {so.so_number}
                    {so.requires_install && (
                      <svg className="h-3 w-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                    <button
                      type="button"
                      onClick={() => setLinkedSos(prev => prev.filter(s => s.id !== so.id))}
                      className="ml-0.5 text-blue-400 hover:text-blue-700"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <SearchableSelect
              value=""
              options={salesOrders
                .filter(so => !linkedSos.some(l => l.id === so.id))
                .map(so => ({
                  value: so.id,
                  label: `${so.so_number}${so.customer_po ? ` — PO: ${so.customer_po}` : ''}${so.requires_install ? ' (install)' : ''}`,
                }))}
              placeholder={form.company_id ? 'Add a sales order...' : 'Select a company first'}
              onChange={(val) => {
                const so = salesOrders.find(s => s.id === val)
                if (so && !linkedSos.some(l => l.id === so.id)) {
                  setLinkedSos(prev => [...prev, so])
                }
              }}
              disabled={!form.company_id}
            />
          </div>
        </div>
      </div>

      {/* Scheduling */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Scheduling</h3>
        <div className="space-y-4">
          {isEdit ? (
            /* Edit mode — single engineer */
            <SearchableSelect
              label="Assigned Engineer"
              value={form.assigned_to}
              options={engineers.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
              placeholder="Search engineers..."
              onChange={(val) => setForm({ ...form, assigned_to: val })}
            />
          ) : (
            /* Create mode — multi-engineer selection */
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Engineers</label>
              {selectedEngineers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedEngineers.map(eng => (
                    <span
                      key={eng.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-800"
                    >
                      {eng.first_name} {eng.last_name}
                      <button
                        type="button"
                        onClick={() => setSelectedEngineers(prev => prev.filter(e => e.id !== eng.id))}
                        className="ml-0.5 text-indigo-400 hover:text-indigo-700"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <SearchableSelect
                value=""
                options={engineers
                  .filter(e => !selectedEngineers.some(se => se.id === e.id))
                  .map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                placeholder="Add an engineer..."
                onChange={(val) => {
                  const eng = engineers.find(e => e.id === val)
                  if (eng && !selectedEngineers.some(se => se.id === eng.id)) {
                    setSelectedEngineers(prev => [...prev, eng])
                  }
                }}
              />
              {selectedEngineers.length > 1 && (
                <p className="mt-1.5 text-xs text-amber-600">
                  {selectedEngineers.length} engineers selected — a separate job will be created for each
                </p>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Estimated Duration</label>
              <select
                value={form.estimated_duration_minutes}
                onChange={e => setForm({ ...form, estimated_duration_minutes: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Is Job Chargeable?</label>
              <select
                value={form.chargeable_type}
                onChange={e => setForm({ ...form, chargeable_type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="as_per_so">As per SO</option>
                <option value="no">No</option>
                <option value="contract">Contract</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Scheduled Time</label>
              <input
                type="time"
                value={form.scheduled_time}
                onChange={e => setForm({ ...form, scheduled_time: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <DateRangePicker
                selectedDates={selectedDates}
                workingDays={workingDays}
                onDatesChange={(dates) => {
                  setSelectedDates(dates)
                  // Keep the form.scheduled_date in sync with the first selected date
                  setForm(prev => ({ ...prev, scheduled_date: dates[0] || '' }))
                }}
              />
            </div>
          )}
          {isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Scheduled Date</label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
          {selectedDates.length > 1 && (
            <p className="text-xs text-amber-600">
              {selectedDates.length} days selected{selectedEngineers.length > 1 ? ` across ${selectedEngineers.length} engineers` : ''} — {selectedDates.length * Math.max(1, selectedEngineers.length)} job{selectedDates.length * Math.max(1, selectedEngineers.length) > 1 ? 's' : ''} will be created
            </p>
          )}
        </div>
      </div>

      {/* Internal Notes */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Internal Notes</h3>
        <p className="mb-2 text-xs text-slate-500">Internal only — not visible to customer</p>
        <textarea
          value={form.internal_notes}
          onChange={e => setForm({ ...form, internal_notes: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <Button
          type="submit"
          variant="primary"
          disabled={saving || !form.company_id || !form.job_type_id || !form.title.trim()}
        >
          {(() => {
            if (saving) return isEdit ? 'Saving...' : 'Creating...'
            if (isEdit) return 'Save Changes'
            const dates = selectedDates.length > 1 ? selectedDates.length : 1
            const engs = Math.max(1, selectedEngineers.length)
            const total = dates * engs
            return total > 1 ? `Create ${total} Jobs` : 'Create Job'
          })()}
        </Button>
      </div>
    </form>
  )
}
