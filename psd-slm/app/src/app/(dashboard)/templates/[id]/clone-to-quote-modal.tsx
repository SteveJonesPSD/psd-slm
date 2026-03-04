'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
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
  customer_type: string | null
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
  customer_type: string | null
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

  // Fetch lookups on mount
  useEffect(() => {
    const fetchLookups = async () => {
      const supabase = createClient()
      const [c, ct, o, b] = await Promise.all([
        supabase.from('customers').select('id, name, customer_type').eq('is_active', true).order('name'),
        supabase.from('contacts').select('id, customer_id, first_name, last_name').eq('is_active', true),
        supabase.from('opportunities').select('id, customer_id, title').not('stage', 'in', '("won","lost")').order('title'),
        supabase.from('brands').select('id, name, is_default, customer_type').eq('is_active', true).order('sort_order'),
      ])
      setCustomers(c.data || [])
      setContacts(ct.data || [])
      setOpportunities(o.data || [])
      setBrands(b.data || [])

      // Auto-select default brand (brand filtering by customer type handled in useEffect)
      const defaultBrand = (b.data || []).find((br) => br.is_default)
      if (defaultBrand && !preSelectedCustomerId) setBrandId(defaultBrand.id)

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

  // Reset contact/opportunity when customer changes
  useEffect(() => {
    if (!preSelectedCustomerId) {
      setContactId('')
      setOpportunityId('')
    }
  }, [customerId, preSelectedCustomerId])

  // Filter brands by selected customer's type
  const selectedCustomerType = customers.find((c) => c.id === customerId)?.customer_type || null
  const filteredBrands = useMemo(() => {
    if (!selectedCustomerType) return brands
    return brands.filter((b) => !b.customer_type || b.customer_type === selectedCustomerType)
  }, [brands, selectedCustomerType])

  // Auto-select brand when customer changes and filtering narrows options
  useEffect(() => {
    if (!selectedCustomerType || brands.length === 0) return
    const matching = brands.filter((b) => !b.customer_type || b.customer_type === selectedCustomerType)
    if (!matching.some((b) => b.id === brandId)) {
      const preferred = matching.find((b) => b.is_default) || matching[0]
      if (preferred) setBrandId(preferred.id)
    }
    if (matching.length === 1) setBrandId(matching[0].id)
  }, [selectedCustomerType]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <SearchableSelect
            label="Customer"
            required
            value={customerId}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Search customers..."
            onChange={setCustomerId}
          />

          {/* Contact */}
          {customerId && filteredContacts.length > 0 && (
            <SearchableSelect
              label="Contact"
              value={contactId}
              options={filteredContacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
              placeholder="Search contacts..."
              onChange={setContactId}
            />
          )}

          {/* Opportunity */}
          {customerId && filteredOpportunities.length > 0 && (
            <SearchableSelect
              label="Opportunity"
              value={opportunityId}
              options={filteredOpportunities.map((o) => ({ value: o.id, label: o.title }))}
              placeholder="Search opportunities..."
              onChange={setOpportunityId}
            />
          )}

          {/* Brand */}
          {filteredBrands.length > 1 && (
            <SearchableSelect
              label="Brand"
              value={brandId}
              options={filteredBrands.map((b) => ({ value: b.id, label: b.is_default ? `${b.name} (Default)` : b.name }))}
              placeholder="Search brands..."
              onChange={setBrandId}
            />
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
