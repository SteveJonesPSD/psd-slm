'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, CUSTOMER_TYPE_CONFIG } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Textarea } from '@/components/ui/form-fields'
import { createCustomer } from './actions'
import type { Customer, Contact } from '@/types/database'

type CustomerWithContacts = Customer & { contacts: Pick<Contact, 'id'>[] }

interface CustomersTableProps {
  customers: CustomerWithContacts[]
}

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'charity', label: 'Charity' },
]

const EMPTY_FORM = {
  name: '',
  customer_type: '',
  dfe_number: '',
  account_number: '',
  address_line1: '',
  address_line2: '',
  city: '',
  county: '',
  postcode: '',
  phone: '',
  email: '',
  website: '',
  payment_terms: '30',
  vat_number: '',
  notes: '',
}

export function CustomersTable({ customers }: CustomersTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.account_number || '').toLowerCase().includes(search.toLowerCase())
  )

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
    const result = await createCustomer(fd)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setShowForm(false)
      setForm(EMPTY_FORM)
      if (result.data?.id) {
        router.push(`/customers/${result.data.id}`)
      }
    }
  }

  const isEducation = form.customer_type === 'education'
  const isCharity = form.customer_type === 'charity'

  const columns: Column<CustomerWithContacts>[] = [
    {
      key: 'account_number',
      label: 'Account',
      nowrap: true,
    },
    {
      key: 'name',
      label: 'Customer',
      render: (r) => <span className="font-semibold">{r.name}</span>,
    },
    {
      key: 'customer_type',
      label: 'Type',
      render: (r) => {
        if (!r.customer_type) return null
        const cfg = CUSTOMER_TYPE_CONFIG[r.customer_type as keyof typeof CUSTOMER_TYPE_CONFIG]
        return cfg ? <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} /> : null
      },
    },
    { key: 'city', label: 'City' },
    { key: 'postcode', label: 'Postcode' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'payment_terms',
      label: 'Terms',
      align: 'center',
      render: (r) => `${r.payment_terms} days`,
    },
    {
      key: 'contacts',
      label: 'Contacts',
      align: 'center',
      render: (r) => r.contacts?.length || 0,
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <div className="flex-1" />
        <Button variant="primary" onClick={() => setShowForm(true)}>
          + New Customer
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/customers/${r.id}`)}
        emptyMessage="No customers found."
      />

      {showForm && (
        <Modal title="New Customer" onClose={() => setShowForm(false)} width={640}>
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
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.customer_type || saving}
            >
              {saving ? 'Saving...' : 'Save Customer'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
