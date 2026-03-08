'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createCustomerContract, createSupportContract, getContactsByCustomer, getPricebookLines } from './actions'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { ContractType, PricebookLine, BillingCycleType } from '@/lib/contracts/types'
import { CONTRACT_CATEGORIES, VISIT_FREQUENCIES, BILLING_FREQUENCIES, RENEWAL_PERIODS, BILLING_CYCLE_LABELS, BILLING_MONTH_OPTIONS } from '@/lib/contracts/types'
import { CONTRACT_CATEGORY_CONFIG } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/form-fields'

interface ContractFormProps {
  customers: { id: string; name: string }[]
  contractTypes: ContractType[]
  opportunities: { id: string; title: string; customer_id: string }[]
  calendars: { id: string; name: string; schedule_weeks: number; status: string }[]
  slaPlans: { id: string; name: string }[]
  preselectedCustomerId?: string
}

export function ContractForm({ customers, contractTypes, opportunities, calendars, slaPlans, preselectedCustomerId }: ContractFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    customer_id: preselectedCustomerId || '',
    contract_type_id: '',
    contact_id: '',
    start_date: `${new Date().getFullYear()}-04-01`,
    end_date: `${new Date().getFullYear() + 1}-03-31`,
    renewal_period: 'april',
    renewal_month: '',
    auto_renew: true,
    annual_value: '',
    billing_frequency: 'annually',
    visit_frequency: '',
    visit_length_hours: '',
    visits_per_year: '',
    sla_plan_id: '',
    monthly_hours: '',
    opportunity_id: '',
    quote_id: '',
    calendar_id: '',
    notes: '',
  })

  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [pricebookLines, setPricebookLines] = useState<Array<PricebookLine & { included: boolean; editBuyPrice: number | null }>>([])

  // Load pricebook lines when support contract type is selected
  useEffect(() => {
    if (selectedType?.category === 'support' && form.contract_type_id) {
      getPricebookLines(form.contract_type_id).then(lines => {
        setPricebookLines(lines.filter(l => l.is_active).map(l => ({ ...l, included: true, editBuyPrice: l.buy_price })))
      })
    } else {
      setPricebookLines([])
    }
  }, [form.contract_type_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate annual value from pricebook lines
  useEffect(() => {
    if (pricebookLines.length > 0) {
      const total = pricebookLines.filter(l => l.included).reduce((s, l) => s + Number(l.annual_price), 0)
      setForm(f => ({ ...f, annual_value: String(total) }))
    }
  }, [pricebookLines])

  // Auto-calculate end date when start date changes
  useEffect(() => {
    if (form.start_date && !form.end_date) {
      const start = new Date(form.start_date)
      start.setFullYear(start.getFullYear() + 1)
      start.setDate(start.getDate() - 1)
      setForm((f) => ({ ...f, end_date: start.toISOString().split('T')[0] }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch contacts when customer changes
  useEffect(() => {
    if (form.customer_id) {
      getContactsByCustomer(form.customer_id).then(setContacts)
    } else {
      setContacts([])
    }
  }, [form.customer_id])

  const selectedType = useMemo(
    () => contractTypes.find((t) => t.id === form.contract_type_id),
    [contractTypes, form.contract_type_id]
  )

  // Group contract types by category
  const typesByCategory = useMemo(() => {
    const groups: Record<string, ContractType[]> = {}
    for (const t of contractTypes) {
      if (!groups[t.category]) groups[t.category] = []
      groups[t.category].push(t)
    }
    return groups
  }, [contractTypes])

  const filteredOpps = useMemo(
    () => (form.customer_id ? opportunities.filter((o) => o.customer_id === form.customer_id) : []),
    [opportunities, form.customer_id]
  )

  // Filter contract types by selected calendar's schedule_weeks
  const selectedCalendar = useMemo(
    () => calendars.find((c) => c.id === form.calendar_id),
    [calendars, form.calendar_id]
  )

  const filteredContractTypes = useMemo(() => {
    if (!selectedCalendar) return contractTypes
    return contractTypes.filter((t) =>
      t.allowed_schedule_weeks?.includes(selectedCalendar.schedule_weeks)
    )
  }, [contractTypes, selectedCalendar])

  // Filter calendars by selected contract type's allowed_schedule_weeks
  const filteredCalendars = useMemo(() => {
    if (!selectedType) return calendars
    return calendars.filter((c) =>
      selectedType.allowed_schedule_weeks?.includes(c.schedule_weeks)
    )
  }, [calendars, selectedType])

  const upd = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const start = e.target.value
    const d = new Date(start)
    d.setFullYear(d.getFullYear() + 1)
    d.setDate(d.getDate() - 1)
    setForm((f) => ({ ...f, start_date: start, end_date: d.toISOString().split('T')[0] }))
  }

  const handleSave = async () => {
    if (!form.customer_id || !form.contract_type_id || !form.start_date) {
      setError('Please fill in all required fields')
      return
    }

    // For non-support contracts, end_date and renewal_period are required
    if (selectedType?.category !== 'support' || !selectedType) {
      if (!form.end_date || !form.renewal_period) {
        setError('Please fill in all required fields')
        return
      }
    }

    setSaving(true)
    setError('')

    let result: { error?: string; data?: unknown & { id: string } }

    // Use createSupportContract for support contracts with pricebook lines
    if (selectedType?.category === 'support' && pricebookLines.length > 0) {
      result = await createSupportContract({
        customer_id: form.customer_id,
        contract_type_id: form.contract_type_id,
        contact_id: form.contact_id || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        billing_cycle_type: selectedType.billing_cycle_type || 'fixed_date',
        billing_month: form.renewal_period === 'april' ? 4 : form.renewal_period === 'september' ? 9 : undefined,
        annual_value: Number(form.annual_value) || 0,
        lines: pricebookLines
          .filter(l => l.included)
          .map((l, i) => ({
            pricebook_line_id: l.id,
            description: l.description,
            annual_price: Number(l.annual_price),
            buy_price: l.editBuyPrice,
            vat_rate: Number(l.vat_rate),
            sort_order: i,
          })),
        notes: form.notes || null,
        calendar_id: form.calendar_id || null,
        sla_plan_id: form.sla_plan_id || null,
        monthly_hours: form.monthly_hours ? Number(form.monthly_hours) : null,
        visit_frequency: form.visit_frequency || null,
        visit_length_hours: form.visit_length_hours ? Number(form.visit_length_hours) : null,
        visits_per_year: form.visits_per_year ? Number(form.visits_per_year) : null,
      })
    } else {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) fd.append(k, String(v))
      })
      result = await createCustomerContract(fd)
    }

    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      router.push(`/contracts/${(result.data as { id: string }).id}`)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-3xl">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Customer */}
        <div className="sm:col-span-2">
          <SearchableSelect
            label="Customer"
            required
            value={form.customer_id}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Search customers..."
            onChange={(val) => setForm((f) => ({ ...f, customer_id: val }))}
          />
        </div>

        {/* Contract Type */}
        <div className="sm:col-span-2">
          <SearchableSelect
            label="Contract Type"
            required
            value={form.contract_type_id}
            options={filteredContractTypes.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Search contract types..."
            onChange={(val) => setForm((f) => ({ ...f, contract_type_id: val }))}
          />
          {selectedCalendar && filteredContractTypes.length < contractTypes.length && (
            <p className="text-xs text-slate-400 mt-1">
              Filtered to types compatible with {selectedCalendar.schedule_weeks}-week calendars
            </p>
          )}
        </div>

        {/* Type info preview */}
        {selectedType && (
          <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
            <div className="font-medium text-slate-700 mb-1">{selectedType.name}</div>
            {selectedType.description && (
              <div className="text-slate-500 mb-1">{selectedType.description}</div>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {selectedType.default_visit_frequency && <span>Frequency: {selectedType.default_visit_frequency}</span>}
              {selectedType.default_visits_per_year && <span>Visits/yr: {selectedType.default_visits_per_year}</span>}
              {selectedType.default_visit_length_hours && <span>Visit length: {selectedType.default_visit_length_hours}h</span>}
              <span className="flex gap-2">
                {selectedType.includes_remote_support && <span className="text-green-600">Remote</span>}
                {selectedType.includes_telephone && <span className="text-green-600">Phone</span>}
                {selectedType.includes_onsite && <span className="text-green-600">Onsite</span>}
              </span>
              {selectedType.default_sla_plan_id && (
                <span>SLA: {slaPlans.find(s => s.id === selectedType.default_sla_plan_id)?.name}</span>
              )}
              {selectedType.default_monthly_hours && <span>Hours/mo: {selectedType.default_monthly_hours}h</span>}
            </div>
          </div>
        )}

        {/* Contact */}
        <SearchableSelect
          label="Contact"
          value={form.contact_id}
          options={contacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
          placeholder="Search contacts..."
          onChange={(val) => setForm((f) => ({ ...f, contact_id: val }))}
          disabled={!form.customer_id}
        />

        {/* Billing Cycle — support contracts only */}
        {selectedType?.category === 'support' && (
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Billing Cycle</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm text-slate-600">
                  {BILLING_CYCLE_LABELS[selectedType.billing_cycle_type || 'fixed_date']}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedType.billing_cycle_type === 'fixed_date'
                    ? 'Year 1 is pro-rata from start date to billing date.'
                    : 'Bills annually on the contract start date.'}
                </p>
              </div>
              {selectedType.billing_cycle_type === 'fixed_date' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Billing Month</label>
                  <select
                    value={form.renewal_period === 'april' ? '4' : form.renewal_period === 'september' ? '9' : ''}
                    onChange={(e) => {
                      const month = e.target.value
                      const period = month === '4' ? 'april' : month === '9' ? 'september' : 'custom'
                      setForm(f => ({ ...f, renewal_period: period }))
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    {BILLING_MONTH_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pricebook Lines — support contracts only */}
        {selectedType?.category === 'support' && pricebookLines.length > 0 && (
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">
              Contract Lines (from pricebook)
            </p>
            <div className="space-y-2">
              {/* Header row */}
              <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mb-1">
                <div className="w-5" />
                <span className="flex-1">Description</span>
                <span className="w-28 text-right">Sell (£/yr)</span>
                <span className="w-28 text-right">Buy (£/yr)</span>
                <span className="w-12" />
              </div>
              {pricebookLines.map((line, idx) => (
                <div key={line.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={line.included}
                    onChange={(e) => {
                      const updated = [...pricebookLines]
                      updated[idx] = { ...updated[idx], included: e.target.checked }
                      setPricebookLines(updated)
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  <span className="flex-1 text-slate-700">{line.description}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={line.annual_price}
                    onChange={(e) => {
                      const updated = [...pricebookLines]
                      updated[idx] = { ...updated[idx], annual_price: Number(e.target.value) }
                      setPricebookLines(updated)
                    }}
                    className="w-28 rounded border border-gray-200 px-2 py-1 text-sm text-right focus:border-indigo-400 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={line.editBuyPrice ?? ''}
                    onChange={(e) => {
                      const updated = [...pricebookLines]
                      updated[idx] = { ...updated[idx], editBuyPrice: e.target.value === '' ? null : Number(e.target.value) }
                      setPricebookLines(updated)
                    }}
                    placeholder="—"
                    className="w-28 rounded border border-gray-200 px-2 py-1 text-sm text-right focus:border-indigo-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 w-12">VAT {line.vat_rate}%</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end text-sm text-slate-500">
              Total: <span className="font-semibold text-slate-700 ml-1">
                {formatCurrency(pricebookLines.filter(l => l.included).reduce((s, l) => s + Number(l.annual_price), 0))}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Prices are editable per contract. Changes here do not affect the pricebook.
            </p>
          </div>
        )}

        {/* Annual Value */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Annual Value (GBP) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.annual_value}
            onChange={upd('annual_value')}
            placeholder="0.00"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          {pricebookLines.length > 0 && (
            <p className="text-xs text-slate-400 mt-1">Auto-calculated from lines above. Override if needed.</p>
          )}
        </div>

        {/* Renewal Period */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Renewal Period <span className="text-red-500">*</span>
          </label>
          <select
            value={form.renewal_period}
            onChange={(e) => {
              const period = e.target.value
              const updates: Partial<typeof form> = { renewal_period: period }

              // Auto-set start date based on renewal period
              if (period === 'april') {
                const year = new Date().getFullYear()
                const start = `${year}-04-01`
                const end = `${year + 1}-03-31`
                updates.start_date = start
                updates.end_date = end
              } else if (period === 'september') {
                const year = new Date().getFullYear()
                const start = `${year}-09-01`
                const end = `${year + 1}-08-31`
                updates.start_date = start
                updates.end_date = end
              }

              setForm((f) => ({ ...f, ...updates }))
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          >
            {RENEWAL_PERIODS.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Custom Renewal Month */}
        {form.renewal_period === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Renewal Month</label>
            <select
              value={form.renewal_month}
              onChange={upd('renewal_month')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Select month...</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2026, i, 1).toLocaleString('en-GB', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Billing Frequency */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Frequency</label>
          <select
            value={form.billing_frequency}
            onChange={upd('billing_frequency')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          >
            {BILLING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.start_date}
            onChange={handleStartDateChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.end_date}
            onChange={upd('end_date')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {/* Auto Renew */}
        <div className="flex items-center gap-3 pt-5">
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={form.auto_renew}
              onChange={(e) => setForm((f) => ({ ...f, auto_renew: e.target.checked }))}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-indigo-600 peer-focus:ring-2 peer-focus:ring-indigo-400 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
          </label>
          <span className="text-sm font-medium text-slate-700">Auto Renew</span>
        </div>

        {/* Visit Overrides (collapsible) */}
        {selectedType && (selectedType.default_visit_frequency || selectedType.default_visits_per_year || selectedType.default_visit_length_hours) && (
          <div className="sm:col-span-2">
            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="text-sm font-medium text-slate-700 cursor-pointer">
                Visit Overrides (optional — leave blank to inherit from contract type)
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Frequency {selectedType.default_visit_frequency && (
                      <span className="text-slate-400">(default: {selectedType.default_visit_frequency})</span>
                    )}
                  </label>
                  <select
                    value={form.visit_frequency}
                    onChange={upd('visit_frequency')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">Inherit</option>
                    {VISIT_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Visit Length (hours) {selectedType.default_visit_length_hours && (
                      <span className="text-slate-400">(default: {selectedType.default_visit_length_hours})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.visit_length_hours}
                    onChange={upd('visit_length_hours')}
                    placeholder="Inherit"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Visits/Year {selectedType.default_visits_per_year && (
                      <span className="text-slate-400">(default: {selectedType.default_visits_per_year})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.visits_per_year}
                    onChange={upd('visits_per_year')}
                    placeholder="Inherit"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
            </details>
          </div>
        )}

        {/* SLA & Support Hours Overrides */}
        {selectedType && (selectedType.default_sla_plan_id || selectedType.default_monthly_hours) ? (
          <div className="sm:col-span-2">
            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="text-sm font-medium text-slate-700 cursor-pointer">
                SLA & Support Hours Overrides (optional — leave blank to inherit from contract type)
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    SLA Plan {selectedType.default_sla_plan_id && (
                      <span className="text-slate-400">(default: {slaPlans.find(s => s.id === selectedType.default_sla_plan_id)?.name})</span>
                    )}
                  </label>
                  <select
                    value={form.sla_plan_id}
                    onChange={upd('sla_plan_id')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">Inherit</option>
                    {slaPlans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Monthly Hours {selectedType.default_monthly_hours && (
                      <span className="text-slate-400">(default: {selectedType.default_monthly_hours}h)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.monthly_hours}
                    onChange={upd('monthly_hours')}
                    placeholder="Inherit"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
            </details>
          </div>
        ) : (
          /* If no defaults from type, show SLA fields directly */
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SLA Plan</label>
              <select
                value={form.sla_plan_id}
                onChange={upd('sla_plan_id')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              >
                <option value="">None</option>
                {slaPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Support Hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.monthly_hours}
                onChange={upd('monthly_hours')}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Opportunity Link */}
        <SearchableSelect
          label="Link to Opportunity"
          value={form.opportunity_id}
          options={filteredOpps.map((o) => ({ value: o.id, label: o.title }))}
          placeholder="Search opportunities..."
          onChange={(val) => setForm((f) => ({ ...f, opportunity_id: val }))}
          disabled={!form.customer_id}
        />

        {/* Visit Calendar */}
        <div>
          <SearchableSelect
            label="Visit Calendar"
            value={form.calendar_id}
            options={filteredCalendars.map((c) => ({ value: c.id, label: `${c.name} (${c.schedule_weeks}-week)` }))}
            placeholder="Select calendar..."
            onChange={(val) => {
              setForm((f) => {
                const cal = calendars.find((c) => c.id === val)
                const typeStillValid = cal && f.contract_type_id
                  ? contractTypes.find((t) => t.id === f.contract_type_id)?.allowed_schedule_weeks?.includes(cal.schedule_weeks)
                  : true
                return { ...f, calendar_id: val, contract_type_id: typeStillValid ? f.contract_type_id : '' }
              })
            }}
          />
          {selectedType && filteredCalendars.length < calendars.length && (
            <p className="text-xs text-slate-400 mt-1">
              Filtered to calendars compatible with {selectedType.name}
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={upd('notes')}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
        <button
          onClick={() => router.push('/contracts')}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <Button
          onClick={handleSave}
          variant="primary"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save as Draft'}
        </Button>
      </div>
    </div>
  )
}
