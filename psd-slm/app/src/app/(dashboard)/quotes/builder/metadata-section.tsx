'use client'

import { useState } from 'react'
import type { QuoteFormState, QuoteAction, CustomerLookup, ContactLookup, UserLookup, BrandLookup } from './quote-builder-types'

interface MetadataSectionProps {
  state: QuoteFormState
  dispatch: React.Dispatch<QuoteAction>
  customers: CustomerLookup[]
  contacts: ContactLookup[]
  users: UserLookup[]
  brands: BrandLookup[]
}

export function MetadataSection({ state, dispatch, customers, contacts, users, brands }: MetadataSectionProps) {
  const [collapsed, setCollapsed] = useState(false)

  const filteredContacts = state.customer_id
    ? contacts.filter((c) => c.customer_id === state.customer_id)
    : []

  const handleCustomerChange = (value: string) => {
    dispatch({ type: 'SET_FIELD', field: 'customer_id', value })
    // Reset contact when customer changes
    dispatch({ type: 'SET_FIELD', field: 'contact_id', value: '' })
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Customer */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Customer *</label>
              <select
                value={state.customer_id}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Contact */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Contact</label>
              <select
                value={state.contact_id}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'contact_id', value: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                disabled={!state.customer_id}
              >
                <option value="">Select contact...</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.email ? ` (${c.email})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned To */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Assigned To</label>
              <select
                value={state.assigned_to}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'assigned_to', value: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Select user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
            </div>

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
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Brand *</label>
              <select
                value={state.brand_id}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'brand_id', value: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">Select brand...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.is_default ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
          </div>
        </div>
      )}
    </div>
  )
}
