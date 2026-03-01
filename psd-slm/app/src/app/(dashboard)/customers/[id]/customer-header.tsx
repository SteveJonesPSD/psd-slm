'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, CUSTOMER_TYPE_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Textarea } from '@/components/ui/form-fields'
import { updateCustomer } from '../actions'
import type { Customer } from '@/types/database'

interface CustomerHeaderProps {
  customer: Customer
}

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'charity', label: 'Charity' },
]

export function CustomerHeader({ customer }: CustomerHeaderProps) {
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState({
    name: customer.name,
    customer_type: customer.customer_type || '',
    dfe_number: customer.dfe_number || '',
    account_number: customer.account_number || '',
    address_line1: customer.address_line1 || '',
    address_line2: customer.address_line2 || '',
    city: customer.city || '',
    county: customer.county || '',
    postcode: customer.postcode || '',
    phone: customer.phone || '',
    email: customer.email || '',
    website: customer.website || '',
    payment_terms: String(customer.payment_terms),
    vat_number: customer.vat_number || '',
    notes: customer.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleDfeLookup = async () => {
    if (!form.dfe_number.trim()) return
    setLookingUp(true)
    setError('')
    try {
      const res = await fetch(`/api/gias-lookup?urn=${encodeURIComponent(form.dfe_number.trim())}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else if (data.urn) {
        setForm((f) => ({
          ...f,
          name: data.establishment_name || f.name,
          address_line1: data.street || f.address_line1,
          address_line2: [data.locality, data.address3].filter(Boolean).join(', ') || f.address_line2,
          city: data.town || f.city,
          county: data.county || f.county,
          postcode: data.postcode || f.postcode,
          phone: data.phone || f.phone,
          website: data.website || f.website,
        }))
      }
    } catch {
      setError('Failed to lookup DfE number')
    }
    setLookingUp(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    const result = await updateCustomer(customer.id, fd)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setShowEdit(false)
      router.refresh()
    }
  }

  const isEducation = form.customer_type === 'education'
  const isCharity = form.customer_type === 'charity'

  const subtitle = [customer.account_number, [customer.city, customer.postcode].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' \u00B7 ')

  const typeCfg = customer.customer_type
    ? CUSTOMER_TYPE_CONFIG[customer.customer_type as keyof typeof CUSTOMER_TYPE_CONFIG]
    : null

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900">{customer.name}</h2>
            {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          )}
        </div>
        <Button onClick={() => setShowEdit(true)}>Edit Customer</Button>
      </div>

      {showEdit && (
        <Modal title="Edit Customer" onClose={() => setShowEdit(false)} width={640}>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Customer Type *"
              options={CUSTOMER_TYPE_OPTIONS}
              placeholder="Select type..."
              value={form.customer_type}
              onChange={upd('customer_type')}
              className="col-span-2"
            />
            {isEducation && (
              <div className="col-span-2 flex gap-2 items-end">
                <Input
                  label="DfE Number (URN)"
                  value={form.dfe_number}
                  onChange={upd('dfe_number')}
                  className="flex-1"
                />
                <Button
                  variant="blue"
                  onClick={handleDfeLookup}
                  disabled={!form.dfe_number.trim() || lookingUp}
                >
                  {lookingUp ? 'Looking up...' : 'Lookup'}
                </Button>
              </div>
            )}
            <Input
              label="Customer Name *"
              value={form.name}
              onChange={upd('name')}
              className="col-span-2"
            />
            <Input
              label="Account Number"
              value={form.account_number}
              onChange={upd('account_number')}
            />
            <Input
              label="Payment Terms (days)"
              type="number"
              value={form.payment_terms}
              onChange={upd('payment_terms')}
            />
            <Input
              label="Address Line 1"
              value={form.address_line1}
              onChange={upd('address_line1')}
              className="col-span-2"
            />
            <Input
              label="Address Line 2"
              value={form.address_line2}
              onChange={upd('address_line2')}
              className="col-span-2"
            />
            <Input label="City" value={form.city} onChange={upd('city')} />
            <Input label="County" value={form.county} onChange={upd('county')} />
            <Input label="Postcode" value={form.postcode} onChange={upd('postcode')} />
            <Input label="Phone" value={form.phone} onChange={upd('phone')} />
            <Input label="Email" value={form.email} onChange={upd('email')} />
            <Input label="Website" value={form.website} onChange={upd('website')} />
            <Input
              label="VAT Number"
              value={form.vat_number}
              onChange={upd('vat_number')}
              disabled={isEducation || isCharity}
            />
            <Textarea
              label="Notes"
              value={form.notes}
              onChange={upd('notes')}
              className="col-span-2"
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
