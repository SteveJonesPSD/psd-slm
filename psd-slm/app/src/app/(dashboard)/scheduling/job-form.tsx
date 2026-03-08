'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import { createJob, updateJob, getContactsForCompany, getSalesOrdersForCompany, type CreateJobInput } from './actions'
import { DateRangePicker } from './date-range-picker'
import { SmartScheduleModal } from './components/smart-schedule-modal'
import type { ScheduleConflict } from '@/lib/scheduling/conflict'

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
  is_primary: boolean
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

interface WorkingHoursConfig {
  working_day_start: string // HH:MM
  working_day_end: string   // HH:MM
}

interface JobFormProps {
  companies: Company[]
  jobTypes: JobTypeOption[]
  engineers: Engineer[]
  workingDays?: number[]
  orgWorkingHours?: WorkingHoursConfig
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
  { value: 480, label: 'Full Day' },
  { value: -1, label: 'Custom' },
]

/** Calculate minutes between two HH:MM strings */
function timeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

/** Add minutes to HH:MM string, return HH:MM */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function JobForm({ companies, jobTypes, engineers, workingDays = [1, 2, 3, 4, 5], orgWorkingHours, initialData, sourceType, sourceId, sourceRef, prefill, initialLinkedSos }: JobFormProps) {
  const router = useRouter()
  const isEdit = !!initialData

  const defaultStart = orgWorkingHours?.working_day_start || '08:00'
  const defaultEnd = orgWorkingHours?.working_day_end || '17:30'

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

  // Duration mode state
  const initDuration = initialData?.estimated_duration_minutes || 60
  const isInitFullDay = initDuration === 480
  const isInitCustom = !isInitFullDay && !DURATION_OPTIONS.some(d => d.value === initDuration && d.value > 0)
  const [isFullDay, setIsFullDay] = useState(isInitFullDay)
  const [isCustomDuration, setIsCustomDuration] = useState(isInitCustom)
  const [customEndTime, setCustomEndTime] = useState(() => {
    if (isInitCustom && initialData?.scheduled_time) {
      return addMinutesToTime(initialData.scheduled_time.substring(0, 5), initDuration)
    }
    return ''
  })

  // Engineer working hours (fetched when engineer changes)
  const [engineerHours, setEngineerHours] = useState<{ start: string; end: string } | null>(null)

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

  // Conflict detection state
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])
  const [conflictDismissed, setConflictDismissed] = useState(false)
  const [showSmartSchedule, setShowSmartSchedule] = useState(false)
  const [ignoreConfirm, setIgnoreConfirm] = useState(false)
  const conflictDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load contacts and sales orders when company changes
  const [initialCompanyId] = useState(form.company_id)
  useEffect(() => {
    if (form.company_id) {
      getContactsForCompany(form.company_id).then(result => {
        if ('data' in result) {
          const contactList = result.data || []
          setContacts(contactList)
          if (!isEdit && form.company_id !== initialCompanyId) {
            const primary = contactList.find(c => c.is_primary)
            setForm(prev => ({ ...prev, contact_id: primary?.id || '' }))
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

  // Fetch engineer working hours when engineer selection changes
  const activeEngineerId = isEdit ? form.assigned_to : (selectedEngineers.length > 0 ? selectedEngineers[0].id : '')
  const activeDate = isEdit ? form.scheduled_date : (selectedDates.length > 0 ? selectedDates[0] : '')
  useEffect(() => {
    if (!activeEngineerId || !activeDate) {
      setEngineerHours(null)
      return
    }
    const dayOfWeek = new Date(activeDate + 'T12:00:00').getDay() // 0=Sun
    const isoDow = dayOfWeek === 0 ? 7 : dayOfWeek // 1=Mon...7=Sun
    fetch(`/api/scheduling/engineer-hours?engineerId=${activeEngineerId}&dayOfWeek=${isoDow}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setEngineerHours({ start: data.start_time || defaultStart, end: data.end_time || defaultEnd })
        } else {
          setEngineerHours(null)
        }
      })
      .catch(() => setEngineerHours(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEngineerId, activeDate])

  // When Full Day is selected, auto-set time from working hours
  const effectiveStart = engineerHours?.start || defaultStart
  const effectiveEnd = engineerHours?.end || defaultEnd
  useEffect(() => {
    if (isFullDay) {
      const duration = timeDiffMinutes(effectiveStart, effectiveEnd)
      setForm(prev => ({
        ...prev,
        scheduled_time: effectiveStart,
        estimated_duration_minutes: duration > 0 ? duration : 480,
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullDay, effectiveStart, effectiveEnd])

  // When Custom end time changes, recalculate duration
  useEffect(() => {
    if (isCustomDuration && form.scheduled_time && customEndTime) {
      const duration = timeDiffMinutes(form.scheduled_time, customEndTime)
      if (duration > 0) {
        setForm(prev => ({ ...prev, estimated_duration_minutes: duration }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomDuration, form.scheduled_time, customEndTime])

  // Auto-fill duration from job type (skip if Full Day or Custom is active)
  useEffect(() => {
    if (isEdit || isFullDay || isCustomDuration) return
    const jt = jobTypes.find(t => t.id === form.job_type_id)
    if (jt) {
      setForm(prev => ({ ...prev, estimated_duration_minutes: jt.default_duration_minutes }))
    }
  }, [form.job_type_id, jobTypes, isEdit, isFullDay, isCustomDuration])

  // Auto-suggest title
  useEffect(() => {
    if (isEdit) return
    const jt = jobTypes.find(t => t.id === form.job_type_id)
    const company = companies.find(c => c.id === form.company_id)
    if (jt && company) {
      setForm(prev => ({ ...prev, title: `${jt.name} — ${company.name}` }))
    }
  }, [form.job_type_id, form.company_id, jobTypes, companies, isEdit])

  // Auto-set chargeable type to 'contract' when job type slug contains 'contract'
  useEffect(() => {
    if (isEdit) return
    const jt = jobTypes.find(t => t.id === form.job_type_id)
    if (jt && jt.slug.includes('contract')) {
      setForm(prev => ({ ...prev, chargeable_type: 'contract' }))
    }
  }, [form.job_type_id, jobTypes, isEdit])

  // Conflict check: fires when engineer + date + time are set
  // In create mode with multiple engineers/dates, check for the first engineer + first date
  const currentEngineerId = isEdit ? form.assigned_to : (selectedEngineers.length > 0 ? selectedEngineers[0].id : '')
  const currentDate = isEdit ? form.scheduled_date : (selectedDates.length > 0 ? selectedDates[0] : '')

  const checkConflicts = useCallback(async () => {
    console.log('[conflict-check] engineerId:', currentEngineerId, 'date:', currentDate, 'time:', form.scheduled_time, 'duration:', form.estimated_duration_minutes)
    if (!currentEngineerId || !currentDate || !form.scheduled_time) {
      setConflicts([])
      return
    }

    const startIso = `${currentDate}T${form.scheduled_time}:00`
    const endDate = new Date(new Date(startIso).getTime() + form.estimated_duration_minutes * 60000)
    const endIso = endDate.toISOString()

    try {
      const res = await fetch('/api/scheduling/check-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerId: currentEngineerId,
          proposedStart: startIso,
          proposedEnd: endIso,
          excludeJobId: initialData?.id,
        }),
      })
      const data = await res.json()
      setConflicts(data.conflicts || [])
      setConflictDismissed(false)
      setIgnoreConfirm(false)
    } catch {
      setConflicts([])
    }
  }, [currentEngineerId, currentDate, form.scheduled_time, form.estimated_duration_minutes, initialData?.id])

  useEffect(() => {
    if (conflictDebounceRef.current) clearTimeout(conflictDebounceRef.current)
    conflictDebounceRef.current = setTimeout(() => {
      checkConflicts()
    }, 500)
    return () => {
      if (conflictDebounceRef.current) clearTimeout(conflictDebounceRef.current)
    }
  }, [checkConflicts])

  // Smart Schedule apply handler
  function handleSmartScheduleApply(engId: string, suggestedStart: string, suggestedEnd: string) {
    const startDate = new Date(suggestedStart)
    const date = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const time = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`

    const endDate = new Date(suggestedEnd)
    const durationMs = endDate.getTime() - startDate.getTime()
    const durationMinutes = Math.round(durationMs / 60000)

    // Check if the resulting duration matches a standard option
    const matchesStandard = DURATION_OPTIONS.some(d => d.value === durationMinutes && d.value > 0)
    if (matchesStandard) {
      setIsFullDay(durationMinutes === 480)
      setIsCustomDuration(false)
      setCustomEndTime('')
    } else {
      // Use custom mode for non-standard durations
      setIsFullDay(false)
      setIsCustomDuration(true)
      setCustomEndTime(`${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`)
    }

    if (isEdit) {
      setForm(prev => ({
        ...prev,
        assigned_to: engId,
        scheduled_date: date,
        scheduled_time: time,
        estimated_duration_minutes: durationMinutes || prev.estimated_duration_minutes,
      }))
    } else {
      // Update engineer
      const eng = engineers.find(e => e.id === engId)
      if (eng) {
        setSelectedEngineers([eng])
      }
      setSelectedDates([date])
      setForm(prev => ({
        ...prev,
        scheduled_date: date,
        scheduled_time: time,
        estimated_duration_minutes: durationMinutes || prev.estimated_duration_minutes,
      }))
    }

    setShowSmartSchedule(false)
  }

  // Helpers for conflict banner
  const hasHardBlock = conflicts.some(c => c.isHardBlock)
  const selectedEngineerName = isEdit
    ? engineers.find(e => e.id === form.assigned_to)
    : (selectedEngineers.length === 1 ? selectedEngineers[0] : null)
  const conflictEngineerName = selectedEngineerName
    ? ('first_name' in selectedEngineerName ? `${selectedEngineerName.first_name} ${selectedEngineerName.last_name}` : '')
    : ''

  const proposedStartIso = currentDate && form.scheduled_time ? `${currentDate}T${form.scheduled_time}:00` : ''
  const proposedEndIso = proposedStartIso ? new Date(new Date(proposedStartIso).getTime() + form.estimated_duration_minutes * 60000).toISOString() : ''
  const jobAddress = [form.site_address_line1, form.site_address_line2, form.site_city, form.site_postcode].filter(Boolean).join(', ')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (form.scheduled_time && !form.scheduled_date) {
        setError('If time is set, date must also be set')
        return
      }
      if (form.scheduled_date && !form.scheduled_time) {
        setError('Start time is required when a date is set')
        return
      }
      if (isCustomDuration && form.scheduled_time && customEndTime && timeDiffMinutes(form.scheduled_time, customEndTime) <= 0) {
        setError('Finish time must be after start time')
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

  const showConflictPanel = conflicts.length > 0 && !conflictDismissed

  return (
    <div className="mx-auto max-w-3xl">
    <form onSubmit={handleSubmit} className="space-y-6">
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Duration</label>
              <select
                value={isFullDay ? 480 : isCustomDuration ? -1 : form.estimated_duration_minutes}
                onChange={e => {
                  const val = parseInt(e.target.value)
                  if (val === 480) {
                    // Full Day
                    setIsFullDay(true)
                    setIsCustomDuration(false)
                    setCustomEndTime('')
                  } else if (val === -1) {
                    // Custom
                    setIsFullDay(false)
                    setIsCustomDuration(true)
                    // Default end time = start + 1hr if start is set
                    if (form.scheduled_time) {
                      const end = addMinutesToTime(form.scheduled_time, 60)
                      setCustomEndTime(end)
                      setForm(prev => ({ ...prev, estimated_duration_minutes: 60 }))
                    }
                  } else {
                    setIsFullDay(false)
                    setIsCustomDuration(false)
                    setCustomEndTime('')
                    setForm(prev => ({ ...prev, estimated_duration_minutes: val }))
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              {isFullDay && (
                <p className="mt-1.5 text-xs text-indigo-600">
                  {effectiveStart} – {effectiveEnd} ({timeDiffMinutes(effectiveStart, effectiveEnd)} min)
                  {engineerHours ? ' (engineer hours)' : ' (org default)'}
                </p>
              )}
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
            {!isFullDay && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start Time *</label>
                <input
                  type="time"
                  value={form.scheduled_time}
                  onChange={e => setForm({ ...form, scheduled_time: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
            {isCustomDuration && !isFullDay && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Finish Time *</label>
                <input
                  type="time"
                  value={customEndTime}
                  onChange={e => setCustomEndTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {form.scheduled_time && customEndTime && timeDiffMinutes(form.scheduled_time, customEndTime) > 0 && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Duration: {timeDiffMinutes(form.scheduled_time, customEndTime)} min
                  </p>
                )}
                {form.scheduled_time && customEndTime && timeDiffMinutes(form.scheduled_time, customEndTime) <= 0 && (
                  <p className="mt-1.5 text-xs text-red-600">
                    Finish time must be after start time
                  </p>
                )}
              </div>
            )}
          </div>
          {/* Date picker + Conflict panel side by side */}
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
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
                <p className="mt-2 text-xs text-amber-600">
                  {selectedDates.length} days selected{selectedEngineers.length > 1 ? ` across ${selectedEngineers.length} engineers` : ''} — {selectedDates.length * Math.max(1, selectedEngineers.length)} job{selectedDates.length * Math.max(1, selectedEngineers.length) > 1 ? 's' : ''} will be created
                </p>
              )}
            </div>

            {/* Conflict Panel — beside calendar */}
            {showConflictPanel && (
              <div className="w-64 flex-shrink-0">
                <div className={`rounded-lg border p-4 ${hasHardBlock ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <svg className={`h-5 w-5 flex-shrink-0 ${hasHardBlock ? 'text-red-500' : 'text-amber-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <p className={`text-sm font-semibold ${hasHardBlock ? 'text-red-800' : 'text-amber-800'}`}>
                        Conflict Detected
                      </p>
                    </div>
                    {!hasHardBlock && (
                      <button type="button" onClick={() => setConflictDismissed(true)} className="text-amber-400 hover:text-amber-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>

                  <p className={`mt-2 text-xs ${hasHardBlock ? 'text-red-700' : 'text-amber-700'}`}>
                    {conflictEngineerName ? `${conflictEngineerName} has ` : ''}
                    {conflicts.length === 1 ? 'a booking' : `${conflicts.length} bookings`}
                    {conflicts.some(c => c.conflictType === 'no_travel_gap')
                      ? ' with no travel gap:'
                      : ' at this time:'}
                  </p>

                  <ul className="mt-2 space-y-2">
                    {conflicts.map((c, i) => {
                      const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
                      const isTravelGap = c.conflictType === 'no_travel_gap'
                      const cardClass = hasHardBlock
                        ? 'border-red-200 bg-red-100/50 text-red-700'
                        : 'border-amber-200 bg-amber-100/50 text-amber-700'
                      if (c.source === 'job') {
                        return (
                          <li key={i} className={`rounded-md border p-2 text-xs ${cardClass}`}>
                            {isTravelGap && (
                              <span className="inline-block rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 mb-1">No travel gap</span>
                            )}
                            <div>
                              <span className="font-semibold">{c.conflictingJobNumber}</span>
                              {c.customerName && <> &mdash; {c.customerName}</>}
                            </div>
                            <div className="mt-0.5 opacity-80">
                              {fmtTime(c.conflictingStart)}&ndash;{fmtTime(c.conflictingEnd)}
                            </div>
                            {c.address && <div className="mt-0.5 opacity-70">{c.address}</div>}
                          </li>
                        )
                      } else {
                        return (
                          <li key={i} className={`rounded-md border p-2 text-xs ${cardClass}`}>
                            {isTravelGap && (
                              <span className="inline-block rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 mb-1">No travel gap</span>
                            )}
                            <div>
                              <span className="font-semibold">{c.conflictingTitle}</span>
                              {' '}&mdash; {c.activityTypeName}
                            </div>
                            {c.isAllDay ? <div className="mt-0.5 opacity-80">All day</div> : <div className="mt-0.5 opacity-80">{fmtTime(c.conflictingStart)}&ndash;{fmtTime(c.conflictingEnd)}</div>}
                          </li>
                        )
                      }
                    })}
                  </ul>

                  <div className="mt-3 flex flex-col gap-2">
                    {!hasHardBlock && (
                      <>
                        <Button
                          type="button"
                          variant="purple"
                          size="sm"
                          onClick={() => setShowSmartSchedule(true)}
                          className="w-full"
                        >
                          Smart Schedule
                        </Button>
                        {!ignoreConfirm ? (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => setIgnoreConfirm(true)}
                            className="w-full"
                          >
                            Ignore & Save Anyway
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => setConflictDismissed(true)}
                            className="w-full"
                          >
                            Yes, Create Conflict
                          </Button>
                        )}
                      </>
                    )}
                    {hasHardBlock && (
                      <p className="text-xs font-medium text-red-700">
                        Cannot book &mdash; engineer is on annual leave
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
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
          disabled={saving || !form.company_id || !form.job_type_id || !form.title.trim() || (hasHardBlock && conflicts.length > 0 && !conflictDismissed)}
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

    {/* Smart Schedule Modal */}
    <SmartScheduleModal
      isOpen={showSmartSchedule}
      onClose={() => setShowSmartSchedule(false)}
      engineerId={currentEngineerId}
      engineerName={conflictEngineerName}
      conflicts={conflicts}
      proposedJobAddress={jobAddress}
      proposedJobDurationMinutes={form.estimated_duration_minutes}
      targetDate={currentDate}
      proposedStart={proposedStartIso}
      proposedEnd={proposedEndIso}
      onApply={handleSmartScheduleApply}
    />
    </div>
  )
}
