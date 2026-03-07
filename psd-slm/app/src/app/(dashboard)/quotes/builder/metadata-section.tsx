'use client'

import { useState, useEffect } from 'react'
import { SearchableSelect } from '@/components/ui/form-fields'
import type { QuoteFormState, QuoteAction, CustomerLookup, ContactLookup, UserLookup, BrandLookup } from './quote-builder-types'

interface MetadataSectionProps {
  state: QuoteFormState
  dispatch: React.Dispatch<QuoteAction>
  customers: CustomerLookup[]
  contacts: ContactLookup[]
  users: UserLookup[]
  brands: BrandLookup[]
}

interface GroupContactInfo {
  groupName: string
  parentCompanyId: string
}

export function MetadataSection({ state, dispatch, customers, contacts, users, brands }: MetadataSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [groupContactInfo, setGroupContactInfo] = useState<GroupContactInfo | null>(null)

  // Fetch group parent info when customer changes
  useEffect(() => {
    if (!state.customer_id) { setGroupContactInfo(null); return }
    let cancelled = false
    async function fetchGroupInfo() {
      try {
        const { getGroupForCompany } = await import('@/lib/company-groups/actions')
        const result = await getGroupForCompany(state.customer_id)
        if (cancelled) return
        if (result.asMembers.length > 0 && result.asMembers[0].parent_company) {
          setGroupContactInfo({
            groupName: result.asMembers[0].name,
            parentCompanyId: result.asMembers[0].parent_company_id,
          })
        } else {
          setGroupContactInfo(null)
        }
      } catch {
        if (!cancelled) setGroupContactInfo(null)
      }
    }
    fetchGroupInfo()
    return () => { cancelled = true }
  }, [state.customer_id])

  const filteredContacts = state.customer_id
    ? contacts.filter((c) => c.customer_id === state.customer_id)
    : []

  // Add parent group contacts if the selected customer is a group member
  const parentGroupContacts = groupContactInfo
    ? contacts.filter((c) => c.customer_id === groupContactInfo.parentCompanyId)
    : []

  // Get the selected customer's type for brand filtering
  const selectedCustomer = customers.find((c) => c.id === state.customer_id)
  const customerType = selectedCustomer?.customer_type || null

  // Filter brands: show matching brands + universal brands (no customer_type set)
  const filteredBrands = customerType
    ? brands.filter((b) => !b.customer_type || b.customer_type === customerType)
    : brands

  const handleCustomerChange = (value: string) => {
    dispatch({ type: 'SET_FIELD', field: 'customer_id', value })
    // Auto-select primary contact, or reset if none
    const customerContacts = contacts.filter((c) => c.customer_id === value)
    const primaryContact = customerContacts.find((c) => c.is_primary)
    dispatch({ type: 'SET_FIELD', field: 'contact_id', value: primaryContact?.id || '' })

    // Auto-populate quote_type and brand from customer type
    const customer = customers.find((c) => c.id === value)
    if (customer?.customer_type) {
      dispatch({ type: 'SET_FIELD', field: 'quote_type', value: customer.customer_type })

      // Filter brands for this customer type
      const matching = brands.filter((b) => !b.customer_type || b.customer_type === customer.customer_type)
      // Only auto-change if current brand is not in the filtered list
      if (!matching.some((b) => b.id === state.brand_id)) {
        const preferred = matching.find((b) => b.is_default) || matching[0]
        if (preferred) {
          dispatch({ type: 'SET_FIELD', field: 'brand_id', value: preferred.id })
        }
      }
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-4">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <h3 className="text-[15px] font-semibold text-slate-900">Quote Details</h3>
        <span className="text-slate-400 text-sm">{collapsed ? '+' : '\u2212'}</span>
      </button>

      {!collapsed && (
        <div className="border-t border-gray-100 px-5 py-4">
          {/* Title — full width */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-500">Title / Description</label>
            <input
              type="text"
              value={state.title}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'title', value: e.target.value })}
              placeholder="e.g. Network Refresh, Wireless Upgrade..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Customer */}
            <SearchableSelect
              label="Customer"
              required
              value={state.customer_id}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Search customers..."
              onChange={handleCustomerChange}
            />

            {/* Contact */}
            <SearchableSelect
              label="Contact"
              value={state.contact_id}
              options={[
                ...filteredContacts.map((c) => ({
                  value: c.id,
                  label: `${c.first_name} ${c.last_name}${c.email ? ` (${c.email})` : ''}`,
                })),
                ...parentGroupContacts.map((c) => ({
                  value: c.id,
                  label: `${c.first_name} ${c.last_name}${c.email ? ` (${c.email})` : ''} [${groupContactInfo?.groupName}]`,
                })),
              ]}
              placeholder="Search contacts..."
              onChange={(val) => dispatch({ type: 'SET_FIELD', field: 'contact_id', value: val })}
              disabled={!state.customer_id}
            />

            {/* Assigned To */}
            <SearchableSelect
              label="Assigned To"
              value={state.assigned_to}
              options={users.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
              placeholder="Search users..."
              onChange={(val) => dispatch({ type: 'SET_FIELD', field: 'assigned_to', value: val })}
            />

            {/* Quote Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Quote Type</label>
              <select
                value={state.quote_type}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'quote_type', value: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Select type...</option>
                <option value="business">Business</option>
                <option value="education">Education</option>
                <option value="charity">Charity</option>
                <option value="public_sector">Public Sector</option>
              </select>
            </div>

            {/* Brand */}
            <SearchableSelect
              label="Brand"
              required
              value={state.brand_id}
              options={filteredBrands.map((b) => ({ value: b.id, label: `${b.name}${b.is_default ? ' (Default)' : ''}` }))}
              placeholder="Search brands..."
              onChange={(val) => dispatch({ type: 'SET_FIELD', field: 'brand_id', value: val })}
            />

            {/* Valid Until */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Valid Until</label>
              <input
                type="date"
                value={state.valid_until}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'valid_until', value: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>

            {/* VAT Rate */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">VAT Rate (%)</label>
              <input
                type="number"
                value={state.vat_rate}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'vat_rate', value: parseFloat(e.target.value) || 0 })}
                step="0.5"
                min="0"
                max="100"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {/* Notes */}
          <div className={`grid grid-cols-1 ${state.revision_notes ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mt-4`}>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Customer Notes</label>
              <textarea
                value={state.customer_notes}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'customer_notes', value: e.target.value })}
                rows={3}
                placeholder="Notes visible to the customer..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Internal Notes</label>
              <textarea
                value={state.internal_notes}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'internal_notes', value: e.target.value })}
                rows={3}
                placeholder="Internal notes (not visible to customer)..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
              />
            </div>
            {state.revision_notes && (
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-600">Revision Notes</label>
                <textarea
                  value={state.revision_notes}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'revision_notes', value: e.target.value })}
                  rows={3}
                  placeholder="Why this revision was created..."
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm outline-none focus:border-amber-400 resize-none"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
