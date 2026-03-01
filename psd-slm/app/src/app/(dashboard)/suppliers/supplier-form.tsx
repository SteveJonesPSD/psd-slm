'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/form-fields'
import { Checkbox } from '@/components/ui/form-fields'
import { createSupplier, updateSupplier } from './actions'
import type { Supplier } from '@/types/database'

interface SupplierFormProps {
  supplier?: Supplier
}

const EMPTY_FORM = {
  name: '',
  account_number: '',
  email: '',
  phone: '',
  website: '',
  payment_terms: '30',
  notes: '',
  is_active: true,
}

export function SupplierForm({ supplier }: SupplierFormProps) {
  const router = useRouter()
  const isEdit = !!supplier

  const [form, setForm] = useState(
    supplier
      ? {
          name: supplier.name,
          account_number: supplier.account_number || '',
          email: supplier.email || '',
          phone: supplier.phone || '',
          website: supplier.website || '',
          payment_terms: String(supplier.payment_terms),
          notes: supplier.notes || '',
          is_active: supplier.is_active,
        }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Supplier name is required')
      return
    }

    setSaving(true)
    setError('')

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))

    const result = isEdit
      ? await updateSupplier(supplier.id, fd)
      : await createSupplier(fd)

    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else if ('data' in result && result.data) {
      router.push(`/suppliers/${result.data.id}`)
    } else {
      router.push(`/suppliers/${supplier!.id}`)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-2xl">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Supplier Name *"
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
          label="Email"
          value={form.email}
          onChange={upd('email')}
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={upd('phone')}
        />
        <Input
          label="Website"
          value={form.website}
          onChange={upd('website')}
          className="col-span-2"
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={upd('notes')}
          className="col-span-2"
        />
        {isEdit && (
          <Checkbox
            label="Active"
            checked={form.is_active}
            onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            className="col-span-2"
          />
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={() => router.back()}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!form.name.trim() || saving}
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Supplier'}
        </Button>
      </div>
    </div>
  )
}
