'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { createContractFromLines, getContractTypes } from '../../contracts/actions'
import type { ContractType, InvoiceFrequency } from '@/lib/contracts/types'

const CONTRACTABLE_TYPES = ['subscription', 'license', 'warranty']
const SERVICE_TYPES = ['subscription']
const LICENSING_TYPES = ['license', 'warranty']

interface QuoteLine {
  id: string
  description: string
  product_id: string | null
  product_type: string | null
  quantity: number
  buy_price: number
  sell_price: number
  group_name: string | null
  is_optional: boolean
}

interface LinkedContract {
  id: string
  contract_number: string
  category: string
  esign_status: string
  status: string
}

interface ContractFromLinesSectionProps {
  quoteId: string
  customerId: string
  lines: QuoteLine[]
  linkedContracts: LinkedContract[]
}

export function ContractFromLinesSection({ quoteId, customerId, lines, linkedContracts }: ContractFromLinesSectionProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [validationError, setValidationError] = useState('')

  // Only show contractable lines
  const contractableLines = lines.filter(l => l.product_type && CONTRACTABLE_TYPES.includes(l.product_type) && !l.is_optional)
  const nonContractableLines = lines.filter(l => !l.product_type || !CONTRACTABLE_TYPES.includes(l.product_type))

  if (contractableLines.length === 0) return null

  // Check for mixed selection
  const selectedLines = contractableLines.filter(l => selectedIds.has(l.id))
  const hasService = selectedLines.some(l => l.product_type && SERVICE_TYPES.includes(l.product_type))
  const hasLicensing = selectedLines.some(l => l.product_type && LICENSING_TYPES.includes(l.product_type))
  const hasMixed = hasService && hasLicensing

  const toggleLine = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setValidationError('')
  }

  const handleOpenModal = () => {
    if (hasMixed) {
      setValidationError('Subscription and License lines must be in separate contracts. Please deselect one type.')
      return
    }
    setShowModal(true)
  }

  const targetCategory = hasService ? 'service' : hasLicensing ? 'licensing' : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-8">
      <h3 className="text-[15px] font-semibold mb-4">Create Contract from Lines</h3>

      {/* Linked contracts info */}
      {linkedContracts.length > 0 && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800 font-medium mb-1">Linked Contracts</p>
          {linkedContracts.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-sm text-blue-700">
              <Link href={`/contracts/${c.id}`} className="text-blue-600 hover:text-blue-800 no-underline font-medium">
                {c.contract_number}
              </Link>
              <Badge
                label={c.category.charAt(0).toUpperCase() + c.category.slice(1)}
                color={c.category === 'service' ? '#2563eb' : '#7c3aed'}
                bg={c.category === 'service' ? '#eff6ff' : '#f5f3ff'}
              />
              <Badge
                label={c.esign_status === 'signed' ? 'Signed' : c.esign_status === 'pending' ? 'Pending' : c.esign_status}
                color={c.esign_status === 'signed' ? '#059669' : '#d97706'}
                bg={c.esign_status === 'signed' ? '#ecfdf5' : '#fffbeb'}
              />
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-10">Contract</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-20">Type</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-14">Qty</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-24">Unit Price</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {contractableLines.map(line => (
              <tr key={line.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(line.id)}
                    onChange={() => toggleLine(line.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                </td>
                <td className="px-3 py-2 font-medium">{line.description}</td>
                <td className="px-3 py-2">
                  <Badge
                    label={line.product_type === 'subscription' ? 'SUB' : line.product_type === 'license' ? 'LIC' : 'WTY'}
                    color={line.product_type === 'subscription' ? '#2563eb' : line.product_type === 'license' ? '#7c3aed' : '#d97706'}
                    bg={line.product_type === 'subscription' ? '#eff6ff' : line.product_type === 'license' ? '#f5f3ff' : '#fffbeb'}
                  />
                </td>
                <td className="px-3 py-2 text-right">{line.quantity}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(line.sell_price)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(line.quantity * line.sell_price)}</td>
              </tr>
            ))}
            {nonContractableLines.slice(0, 3).map(line => (
              <tr key={line.id} className="border-b border-slate-50 text-slate-400">
                <td className="px-3 py-2">
                  <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </td>
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-xs">{line.product_type || 'goods'}</td>
                <td className="px-3 py-2 text-right">{line.quantity}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(line.sell_price)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(line.quantity * line.sell_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validationError && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">
          {validationError}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <span className="text-sm text-slate-500">
          {selectedIds.size} line{selectedIds.size !== 1 ? 's' : ''} selected
        </span>
        <Button
          size="sm"
          variant="primary"
          disabled={selectedIds.size === 0}
          onClick={handleOpenModal}
        >
          Create Contract from Selected Lines
        </Button>
      </div>

      {showModal && targetCategory && (
        <CreateContractModal
          quoteId={quoteId}
          customerId={customerId}
          selectedLines={selectedLines}
          targetCategory={targetCategory}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function CreateContractModal({
  quoteId,
  customerId,
  selectedLines,
  targetCategory,
  onClose,
}: {
  quoteId: string
  customerId: string
  selectedLines: QuoteLine[]
  targetCategory: 'service' | 'licensing'
  onClose: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ contractId: string; contractNumber: string } | null>(null)
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  const autoAnnualValue = selectedLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)

  const [form, setForm] = useState({
    contract_type_id: '',
    go_live_date: new Date().toISOString().split('T')[0],
    term_months: '' as string,
    auto_invoice: false,
    invoice_frequency: 'annual' as InvoiceFrequency,
    notice_alert_days: '180',
    secondary_alert_days: '90',
    annual_value: String(autoAnnualValue),
  })

  // Fetch contract types on mount
  useState(() => {
    getContractTypes().then(types => {
      const filtered = types.filter(t => t.category === targetCategory && t.is_active)
      setContractTypes(filtered)
      setLoadingTypes(false)
      // Auto-select if only one type
      if (filtered.length === 1) {
        const t = filtered[0]
        setForm(f => ({
          ...f,
          contract_type_id: t.id,
          auto_invoice: t.auto_invoice,
          invoice_frequency: t.invoice_frequency,
          term_months: t.default_term_months ? String(t.default_term_months) : '',
          notice_alert_days: String(t.default_notice_alert_days),
          secondary_alert_days: String(t.secondary_alert_days),
        }))
      }
    })
  })

  const selectedType = contractTypes.find(t => t.id === form.contract_type_id)

  const handleTypeChange = (typeId: string) => {
    const t = contractTypes.find(ct => ct.id === typeId)
    if (t) {
      setForm(f => ({
        ...f,
        contract_type_id: typeId,
        auto_invoice: t.auto_invoice,
        invoice_frequency: t.invoice_frequency,
        term_months: t.default_term_months ? String(t.default_term_months) : f.term_months,
        notice_alert_days: String(t.default_notice_alert_days),
        secondary_alert_days: String(t.secondary_alert_days),
      }))
    }
  }

  const handleConfirm = async () => {
    if (!form.contract_type_id) {
      setError('Please select a contract type')
      return
    }
    setSaving(true)
    setError('')

    const res = await createContractFromLines({
      quote_id: quoteId,
      customer_id: customerId,
      contract_type_id: form.contract_type_id,
      selected_line_ids: selectedLines.map(l => l.id),
      go_live_date: form.go_live_date,
      term_months: form.term_months ? Number(form.term_months) : null,
      notice_alert_days: Number(form.notice_alert_days) || 180,
      secondary_alert_days: Number(form.secondary_alert_days) || 90,
      auto_invoice: form.auto_invoice,
      invoice_frequency: form.invoice_frequency,
      annual_value: Number(form.annual_value) || autoAnnualValue,
    })

    setSaving(false)
    if (res.success && res.contractId && res.contractNumber) {
      setResult({ contractId: res.contractId, contractNumber: res.contractNumber })
    } else {
      setError(res.error || 'Failed to create contract')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {result ? (
          // Success state
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Contract Created</h3>
            <p className="text-sm text-slate-500 mb-4">
              Contract <span className="font-semibold text-indigo-600">{result.contractNumber}</span> has been created as a draft.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="primary" onClick={() => router.push(`/contracts/${result.contractId}`)}>
                View Contract
              </Button>
              <Button variant="default" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : step === 1 ? (
          // Step 1: Configuration
          <>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              Create {targetCategory === 'service' ? 'Service' : 'Licensing'} Contract
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {selectedLines.length} line{selectedLines.length !== 1 ? 's' : ''} selected
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contract Type *</label>
                {loadingTypes ? (
                  <div className="text-sm text-slate-400">Loading types...</div>
                ) : (
                  <select
                    value={form.contract_type_id}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">Select a contract type...</option>
                    {contractTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Go-Live Date *</label>
                <input
                  type="date"
                  value={form.go_live_date}
                  onChange={(e) => setForm(f => ({ ...f, go_live_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Term</label>
                  <select
                    value={form.term_months}
                    onChange={(e) => setForm(f => ({ ...f, term_months: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    {targetCategory === 'licensing' && <option value="">Open-ended</option>}
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
                    onChange={(e) => setForm(f => ({ ...f, invoice_frequency: e.target.value as InvoiceFrequency }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="annual">Annual</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={form.auto_invoice}
                    onChange={(e) => setForm(f => ({ ...f, auto_invoice: e.target.checked }))}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-indigo-600 peer-focus:ring-2 peer-focus:ring-indigo-400 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <span className="text-sm text-slate-700">Auto-Invoice</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notice Alert (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.notice_alert_days}
                    onChange={(e) => setForm(f => ({ ...f, notice_alert_days: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Alert (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.secondary_alert_days}
                    onChange={(e) => setForm(f => ({ ...f, secondary_alert_days: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Annual Value (GBP)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.annual_value}
                  onChange={(e) => setForm(f => ({ ...f, annual_value: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Auto-calculated from selected lines. Editable.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={() => setStep(2)} disabled={!form.contract_type_id}>
                Continue
              </Button>
            </div>
          </>
        ) : (
          // Step 2: Preview & Confirm
          <>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Confirm Contract</h3>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>
            )}

            <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Description</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500 w-16">Type</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-500 w-12">Qty</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-500 w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-500 w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLines.map(line => (
                    <tr key={line.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 font-medium">{line.description}</td>
                      <td className="px-3 py-2">
                        <Badge
                          label={line.product_type === 'subscription' ? 'SUB' : line.product_type === 'license' ? 'LIC' : 'WTY'}
                          color={line.product_type === 'subscription' ? '#2563eb' : line.product_type === 'license' ? '#7c3aed' : '#d97706'}
                          bg={line.product_type === 'subscription' ? '#eff6ff' : line.product_type === 'license' ? '#f5f3ff' : '#fffbeb'}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">{line.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(line.sell_price)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(line.quantity * line.sell_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-3 py-2 text-right font-semibold text-slate-700">Annual Value</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">
                      {formatCurrency(Number(form.annual_value) || autoAnnualValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="text-sm text-slate-500 space-y-1 mb-4">
              <p><span className="font-medium text-slate-700">Contract Type:</span> {selectedType?.name}</p>
              <p><span className="font-medium text-slate-700">Go-Live:</span> {new Date(form.go_live_date).toLocaleDateString('en-GB')}</p>
              <p><span className="font-medium text-slate-700">Term:</span> {form.term_months ? `${form.term_months} months` : 'Open-ended'}</p>
              <p><span className="font-medium text-slate-700">Billing:</span> {form.invoice_frequency} {form.auto_invoice ? '(auto)' : '(manual)'}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={() => setStep(1)}>Back</Button>
              <Button variant="success" onClick={handleConfirm} disabled={saving}>
                {saving ? 'Creating...' : 'Confirm & Create Contract'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
