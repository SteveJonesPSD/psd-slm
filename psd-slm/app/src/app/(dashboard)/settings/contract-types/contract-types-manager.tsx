'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Badge, CONTRACT_CATEGORY_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createContractType, updateContractType, getActiveContractCountForType, getPricebookLines, savePricebookLines } from '../../contracts/actions'
import type { ContractType, InvoiceFrequency, BillingCycleType, PricebookLine } from '@/lib/contracts/types'
import { CONTRACT_CATEGORIES, VISIT_FREQUENCIES, BILLING_CYCLE_LABELS, BILLING_MONTH_OPTIONS } from '@/lib/contracts/types'

interface SlaPlanOption {
  id: string
  name: string
}

interface ContractTypesManagerProps {
  types: ContractType[]
  slaPlans: SlaPlanOption[]
}

function formatCode(code: string): string {
  return code
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function ContractTypesManager({ types, slaPlans }: ContractTypesManagerProps) {
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">SLA Plan</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Hours/Mo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Calendars</th>
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
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                        {formatCode(t.code)}
                      </span>
                    </td>
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
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {slaPlans.find(s => s.id === t.default_sla_plan_id)?.name || '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-500">
                      {t.default_monthly_hours ? `${t.default_monthly_hours}h` : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-slate-500">
                        {t.allowed_schedule_weeks?.join(', ') || 'All'}
                      </span>
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
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-slate-400">
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
          slaPlans={slaPlans}
          onClose={() => { setShowModal(false); setEditingType(null) }}
          onSaved={() => { setShowModal(false); setEditingType(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function ContractTypeModal({
  type,
  slaPlans,
  onClose,
  onSaved,
}: {
  type: ContractType | null
  slaPlans: SlaPlanOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!type
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [tab, setTab] = useState<'general' | 'pricebook'>('general')
  const [pricebookLines, setPricebookLines] = useState<Array<PricebookLine & { _new?: boolean }>>([])
  const [pricebookLoaded, setPricebookLoaded] = useState(false)
  const [savingPricebook, setSavingPricebook] = useState(false)

  const [form, setForm] = useState({
    name: type?.name || '',
    code: type?.code || '',
    description: type?.description || '',
    category: type?.category || 'support',
    billing_cycle_type: (type?.billing_cycle_type || 'go_live_date') as BillingCycleType,
    default_billing_month: type?.default_billing_month ? String(type.default_billing_month) : '',
    default_visit_frequency: type?.default_visit_frequency || '',
    default_visit_length_hours: type?.default_visit_length_hours ? String(type.default_visit_length_hours) : '',
    default_visits_per_year: type?.default_visits_per_year ? String(type.default_visits_per_year) : '',
    includes_remote_support: type?.includes_remote_support ?? false,
    includes_telephone: type?.includes_telephone ?? false,
    includes_onsite: type?.includes_onsite ?? false,
    default_sla_plan_id: type?.default_sla_plan_id || '',
    default_monthly_hours: type?.default_monthly_hours ? String(type.default_monthly_hours) : '',
    allowed_schedule_weeks: type?.allowed_schedule_weeks ?? [36, 39],
    sort_order: type?.sort_order ? String(type.sort_order) : '0',
    // Billing/term fields for service/licensing
    default_term_months: type?.default_term_months ? String(type.default_term_months) : '',
    auto_invoice: type?.auto_invoice ?? false,
    invoice_frequency: (type?.invoice_frequency || 'annual') as InvoiceFrequency,
    default_notice_alert_days: type?.default_notice_alert_days ? String(type.default_notice_alert_days) : '180',
    secondary_alert_days: type?.secondary_alert_days ? String(type.secondary_alert_days) : '90',
  })

  const isSupport = form.category === 'support'
  const isServiceOrLicensing = form.category === 'service' || form.category === 'licensing'

  // Load pricebook lines when switching to pricebook tab
  const loadPricebook = async () => {
    if (!type?.id || pricebookLoaded) return
    const lines = await getPricebookLines(type.id)
    setPricebookLines(lines as Array<PricebookLine & { _new?: boolean }>)
    setPricebookLoaded(true)
  }

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
    fd.append('billing_cycle_type', form.billing_cycle_type)
    fd.append('default_billing_month', form.default_billing_month)
    fd.append('default_visit_frequency', form.default_visit_frequency)
    fd.append('default_visit_length_hours', form.default_visit_length_hours)
    fd.append('default_visits_per_year', form.default_visits_per_year)
    fd.append('includes_remote_support', String(form.includes_remote_support))
    fd.append('includes_telephone', String(form.includes_telephone))
    fd.append('includes_onsite', String(form.includes_onsite))
    fd.append('default_sla_plan_id', form.default_sla_plan_id)
    fd.append('default_monthly_hours', form.default_monthly_hours)
    fd.append('allowed_schedule_weeks', JSON.stringify(form.allowed_schedule_weeks))
    fd.append('sort_order', form.sort_order)
    // Billing/term fields
    fd.append('default_term_months', form.default_term_months)
    fd.append('auto_invoice', String(form.auto_invoice))
    fd.append('invoice_frequency', form.invoice_frequency)
    fd.append('default_notice_alert_days', form.default_notice_alert_days)
    fd.append('secondary_alert_days', form.secondary_alert_days)

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

        {/* Tabs — only show Pricebook tab for support category */}
        {isEdit && isSupport && (
          <div className="flex border-b border-slate-200 mb-4">
            <button
              onClick={() => setTab('general')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'general' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              General
            </button>
            <button
              onClick={() => { setTab('pricebook'); loadPricebook() }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'pricebook' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Pricebook
            </button>
          </div>
        )}

        {/* Pricebook tab content */}
        {tab === 'pricebook' ? (
          <PricebookEditor
            lines={pricebookLines}
            onChange={setPricebookLines}
            onSave={async () => {
              if (!type?.id) return
              setSavingPricebook(true)
              const result = await savePricebookLines(
                type.id,
                pricebookLines.map((l, i) => ({
                  id: l._new ? undefined : l.id,
                  description: l.description,
                  annual_price: l.annual_price,
                  buy_price: l.buy_price,
                  vat_rate: l.vat_rate,
                  sort_order: i,
                  is_active: l.is_active,
                }))
              )
              setSavingPricebook(false)
              if (result.error) setError(result.error)
              else {
                // Reload pricebook
                setPricebookLoaded(false)
                loadPricebook()
              }
            }}
            saving={savingPricebook}
          />
        ) : (
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

          {/* Billing cycle — support only */}
          {isSupport && (
            <div className="border-t border-slate-200 pt-3 mt-1">
              <p className="text-sm font-medium text-slate-700 mb-3">Billing Cycle</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Billing Cycle Type</label>
                  <select
                    value={form.billing_cycle_type}
                    onChange={(e) => setForm((f) => ({ ...f, billing_cycle_type: e.target.value as BillingCycleType }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="fixed_date">{BILLING_CYCLE_LABELS.fixed_date}</option>
                    <option value="start_date">{BILLING_CYCLE_LABELS.start_date}</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    {form.billing_cycle_type === 'fixed_date'
                      ? 'Bills on a fixed date each year (e.g. 1 Apr or 1 Sep). Year 1 is pro-rata.'
                      : 'Bills on the anniversary of the contract start date.'}
                  </p>
                </div>
                {form.billing_cycle_type === 'fixed_date' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Default Billing Month</label>
                    <select
                      value={form.default_billing_month}
                      onChange={(e) => setForm((f) => ({ ...f, default_billing_month: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    >
                      <option value="">Not set</option>
                      {BILLING_MONTH_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default SLA Plan</label>
              <select
                value={form.default_sla_plan_id}
                onChange={(e) => setForm((f) => ({ ...f, default_sla_plan_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              >
                <option value="">None</option>
                {slaPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Applied to new contracts of this type</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Monthly Hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.default_monthly_hours}
                onChange={upd('default_monthly_hours')}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">Support hours allowance per month</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Allowed Calendar Lengths</label>
            <div className="flex flex-wrap gap-4">
              {[
                { weeks: 36, label: '36-week' },
                { weeks: 39, label: '39-week' },
              ].map(({ weeks, label }) => (
                <label key={weeks} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowed_schedule_weeks.includes(weeks)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        allowed_schedule_weeks: e.target.checked
                          ? [...f.allowed_schedule_weeks, weeks].sort()
                          : f.allowed_schedule_weeks.filter(w => w !== weeks),
                      }))
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">Controls which calendar types this contract can be assigned to</p>
          </div>

          {/* Service/Licensing billing fields */}
          {isServiceOrLicensing && (
            <div className="border-t border-slate-200 pt-3 mt-1">
              <p className="text-sm font-medium text-slate-700 mb-3">Billing & Term Defaults</p>
              <div className="mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-500">
                Billing cycle: <strong>Go-Live Date</strong> (Year 1 invoiced via Sales Order)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Default Term</label>
                  <select
                    value={form.default_term_months}
                    onChange={(e) => setForm((f) => ({ ...f, default_term_months: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">Open-ended</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                    <option value="60">60 months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Frequency</label>
                  <select
                    value={form.invoice_frequency}
                    onChange={(e) => setForm((f) => ({ ...f, invoice_frequency: e.target.value as InvoiceFrequency }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="annual">Annual</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.auto_invoice}
                    onChange={(e) => setForm((f) => ({ ...f, auto_invoice: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  <span className="text-sm text-slate-700">Auto-Invoice (generate draft invoices on schedule)</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notice Alert (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.default_notice_alert_days}
                    onChange={(e) => setForm((f) => ({ ...f, default_notice_alert_days: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">First alert before contract end</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Alert (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.secondary_alert_days}
                    onChange={(e) => setForm((f) => ({ ...f, secondary_alert_days: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">Second (urgent) alert threshold</p>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          {tab === 'general' && (
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PricebookEditor Component
// ============================================================

function PricebookEditor({
  lines,
  onChange,
  onSave,
  saving,
}: {
  lines: Array<PricebookLine & { _new?: boolean }>
  onChange: (lines: Array<PricebookLine & { _new?: boolean }>) => void
  onSave: () => void
  saving: boolean
}) {
  const addLine = () => {
    onChange([
      ...lines,
      {
        id: `new-${Date.now()}`,
        org_id: '',
        contract_type_id: '',
        description: '',
        annual_price: 0,
        buy_price: null,
        vat_rate: 20,
        sort_order: lines.length,
        is_active: true,
        _new: true,
      },
    ])
  }

  const updateLine = (index: number, field: string, value: unknown) => {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index))
  }

  const total = lines.filter(l => l.is_active).reduce((s, l) => s + Number(l.annual_price), 0)

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Default prices copied into each new contract. Existing contracts are not affected by changes here.
      </p>

      {lines.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          No pricebook lines yet.
        </div>
      ) : (
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={line.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${line.is_active ? 'border-gray-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
              <input
                type="text"
                value={line.description}
                onChange={(e) => updateLine(idx, 'description', e.target.value)}
                placeholder="Description"
                className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-400 mb-0.5">Sell</span>
                <input
                  type="number"
                  step="0.01"
                  value={line.annual_price || ''}
                  onChange={(e) => updateLine(idx, 'annual_price', Number(e.target.value))}
                  placeholder="Sell £/yr"
                  className="w-28 rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-400 mb-0.5">Buy</span>
                <input
                  type="number"
                  step="0.01"
                  value={line.buy_price ?? ''}
                  onChange={(e) => updateLine(idx, 'buy_price', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="—"
                  className="w-28 rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <select
                value={line.vat_rate}
                onChange={(e) => updateLine(idx, 'vat_rate', Number(e.target.value))}
                className="w-20 rounded border border-gray-200 px-1 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
              >
                <option value="20">20%</option>
                <option value="0">0%</option>
                <option value="5">5%</option>
              </select>
              <button
                onClick={() => updateLine(idx, 'is_active', !line.is_active)}
                className={`text-xs px-2 py-1 rounded ${line.is_active ? 'text-green-600 hover:text-amber-600' : 'text-slate-400 hover:text-green-600'}`}
                title={line.is_active ? 'Deactivate' : 'Activate'}
              >
                {line.is_active ? 'Active' : 'Inactive'}
              </button>
              <button
                onClick={() => removeLine(idx)}
                className="text-xs text-red-400 hover:text-red-600"
                title="Remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <div className="flex justify-end text-sm text-slate-500">
          Total (active): <span className="font-semibold text-slate-700 ml-1">
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(total)}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={addLine}>
          + Add Line
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Pricebook'}
        </Button>
      </div>
    </div>
  )
}
