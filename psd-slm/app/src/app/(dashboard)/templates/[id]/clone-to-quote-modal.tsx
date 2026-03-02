'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cloneTemplateToQuote } from '../actions'

interface CloneToQuoteModalProps {
  templateId: string
  templateName: string
  onClose: () => void
  // Pre-fill from opportunity context
  preSelectedCustomerId?: string
  preSelectedOpportunityId?: string
}

interface CustomerOption {
  id: string
  name: string
}

interface ContactOption {
  id: string
  customer_id: string
  first_name: string
  last_name: string
}

interface OpportunityOption {
  id: string
  customer_id: string
  title: string
}

interface BrandOption {
  id: string
  name: string
  is_default: boolean
}

export function CloneToQuoteModal({
  templateId,
  templateName,
  onClose,
  preSelectedCustomerId,
  preSelectedOpportunityId,
}: CloneToQuoteModalProps) {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([])
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [customerId, setCustomerId] = useState(preSelectedCustomerId || '')
  const [contactId, setContactId] = useState('')
  const [opportunityId, setOpportunityId] = useState(preSelectedOpportunityId || '')
  const [brandId, setBrandId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  // Fetch lookups on mount
  useEffect(() => {
    const fetchLookups = async () => {
      const supabase = createClient()
      const [c, ct, o, b] = await Promise.all([
        supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
        supabase.from('contacts').select('id, customer_id, first_name, last_name').eq('is_active', true),
        supabase.from('opportunities').select('id, customer_id, title').not('stage', 'in', '("won","lost")').order('title'),
        supabase.from('brands').select('id, name, is_default').eq('is_active', true).order('sort_order'),
      ])
      setCustomers(c.data || [])
      setContacts(ct.data || [])
      setOpportunities(o.data || [])
      setBrands(b.data || [])

      // Auto-select default brand
      const defaultBrand = (b.data || []).find((br) => br.is_default)
      if (defaultBrand) setBrandId(defaultBrand.id)

      setLoading(false)
    }
    fetchLookups()
  }, [])

  // Filter contacts and opportunities by selected customer
  const filteredContacts = useMemo(
    () => contacts.filter((c) => c.customer_id === customerId),
    [contacts, customerId]
  )

  const filteredOpportunities = useMemo(
    () => opportunities.filter((o) => o.customer_id === customerId),
    [opportunities, customerId]
  )

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers
    const q = customerSearch.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q))
  }, [customers, customerSearch])

  // Reset contact/opportunity when customer changes
  useEffect(() => {
    if (!preSelectedCustomerId) {
      setContactId('')
      setOpportunityId('')
    }
  }, [customerId, preSelectedCustomerId])

  const handleCreate = async () => {
    if (!customerId) return
    setCreating(true)
    const result = await cloneTemplateToQuote(templateId, customerId, {
      contactId: contactId || undefined,
      opportunityId: opportunityId || undefined,
      brandId: brandId || undefined,
    })
    setCreating(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else if ('data' in result && result.data) {
      onClose()
      router.push(`/quotes/${result.data.id}/edit`)
    }
  }

  return (
    <Modal title="Create Quote from Template" onClose={onClose} width={500}>
      <p className="text-sm text-slate-500 mb-4">
        Using template: <strong>{templateName}</strong>
      </p>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Customer */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 mb-1"
            />
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              size={Math.min(6, filteredCustomers.length + 1)}
            >
              <option value="">Select customer...</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Contact */}
          {customerId && filteredContacts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">None</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Opportunity */}
          {customerId && filteredOpportunities.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Opportunity</label>
              <select
                value={opportunityId}
                onChange={(e) => setOpportunityId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">None</option>
                {filteredOpportunities.map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Brand */}
          {brands.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Brand</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">None</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
            Deal registration pricing will be applied automatically for the selected customer.
            The quote will be created as a draft with 100% direct attribution.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleCreate}
              disabled={!customerId || creating}
            >
              {creating ? 'Creating...' : 'Create Quote'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
