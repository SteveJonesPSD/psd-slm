'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Checkbox } from '@/components/ui/form-fields'
import { createContact, updateContact, deleteContact } from '../actions'
import type { Contact } from '@/types/database'

interface ContactsSectionProps {
  contacts: Contact[]
  customerId: string
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  job_title: '',
  email: '',
  phone: '',
  mobile: '',
  is_primary: false,
  is_billing: false,
}

export function ContactsSection({ contacts, customerId }: ContactsSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const openAdd = () => {
    setEditing(null)
    const isFirst = contacts.length === 0
    setForm({ ...EMPTY_FORM, is_primary: isFirst, is_billing: isFirst })
    setError('')
    setShowForm(true)
  }

  const openEdit = (contact: Contact) => {
    setEditing(contact)
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      job_title: contact.job_title || '',
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      is_primary: contact.is_primary,
      is_billing: contact.is_billing,
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const fd = new FormData()
    fd.append('first_name', form.first_name)
    fd.append('last_name', form.last_name)
    fd.append('job_title', form.job_title)
    fd.append('email', form.email)
    fd.append('phone', form.phone)
    fd.append('mobile', form.mobile)
    fd.append('is_primary', String(form.is_primary))
    fd.append('is_billing', String(form.is_billing))

    const result = editing
      ? await updateContact(editing.id, customerId, fd)
      : await createContact(customerId, fd)

    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setShowForm(false)
      setForm(EMPTY_FORM)
      setEditing(null)
      router.refresh()
    }
  }

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Delete ${contact.first_name} ${contact.last_name}?`)) return
    const result = await deleteContact(contact.id, customerId)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => (
        <span className="font-semibold">
          {r.first_name} {r.last_name}
        </span>
      ),
    },
    { key: 'job_title', label: 'Title' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'mobile',
      label: 'Mobile',
    },
    {
      key: 'is_primary',
      label: 'Role',
      align: 'center',
      render: (r) => (
        <div className="flex items-center gap-1 justify-center">
          {r.is_primary && <Badge label="Primary" color="#059669" bg="#ecfdf5" />}
          {r.is_billing && <Badge label="Billing" color="#7c3aed" bg="#f5f3ff" />}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r) }}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700"
            onClick={(e) => { e.stopPropagation(); handleDelete(r) }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Contacts</h3>
        <Button size="sm" variant="primary" onClick={openAdd}>
          + New Contact
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={contacts}
        emptyMessage="No contacts yet. Add your first contact."
      />

      {showForm && (
        <Modal
          title={editing ? 'Edit Contact' : 'New Contact'}
          onClose={() => setShowForm(false)}
          width={540}
        >
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="First Name *"
              value={form.first_name}
              onChange={upd('first_name')}
            />
            <Input
              label="Last Name *"
              value={form.last_name}
              onChange={upd('last_name')}
            />
            <Input
              label="Job Title"
              value={form.job_title}
              onChange={upd('job_title')}
              className="col-span-2"
            />
            <Input label="Email" value={form.email} onChange={upd('email')} />
            <Input label="Phone" value={form.phone} onChange={upd('phone')} />
            <Input label="Mobile" value={form.mobile} onChange={upd('mobile')} />
            <div className="flex items-end gap-4 pb-1 col-span-2">
              <Checkbox
                label="Primary contact"
                checked={form.is_primary}
                onChange={(v) => setForm((f) => ({ ...f, is_primary: v }))}
              />
              <Checkbox
                label="Billing contact"
                checked={form.is_billing}
                onChange={(v) => setForm((f) => ({ ...f, is_billing: v }))}
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!form.first_name.trim() || !form.last_name.trim() || saving}
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Contact'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
