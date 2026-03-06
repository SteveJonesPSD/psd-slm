'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Checkbox } from '@/components/ui/form-fields'
import { createContact, updateContact, deleteContact } from '../actions'
import { searchContactsForLinking, addContactCustomerLink } from '../link-actions'
import { AiContactModal } from './ai-contact-modal'
import { CollapsibleCard } from './collapsible-card'
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
  is_shipping: false,
  is_portal_user: false,
  is_portal_admin: false,
}

export function ContactsSection({ contacts, customerId }: ContactsSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aiModalMode, setAiModalMode] = useState<'screenshot' | 'paste' | null>(null)
  const [showAiDropdown, setShowAiDropdown] = useState(false)
  const aiDropdownRef = useRef<HTMLDivElement>(null)
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults, setLinkResults] = useState<{ id: string; first_name: string; last_name: string; email: string | null; customer_name: string }[]>([])
  const [linkSearching, setLinkSearching] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    if (!showAiDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) {
        setShowAiDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAiDropdown])

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const openAdd = () => {
    setEditing(null)
    const isFirst = contacts.length === 0
    setForm({ ...EMPTY_FORM, is_primary: isFirst, is_billing: isFirst, is_shipping: isFirst })
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
      is_shipping: contact.is_shipping,
      is_portal_user: contact.is_portal_user,
      is_portal_admin: contact.is_portal_admin,
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
    fd.append('is_shipping', String(form.is_shipping))
    fd.append('is_portal_user', String(form.is_portal_user))
    fd.append('is_portal_admin', String(form.is_portal_admin))

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

  const handleLinkSearch = async (query: string) => {
    setLinkSearch(query)
    if (query.length < 2) { setLinkResults([]); return }
    setLinkSearching(true)
    try {
      const data = await searchContactsForLinking(query, customerId)
      setLinkResults(data)
    } catch { /* best-effort */ } finally {
      setLinkSearching(false)
    }
  }

  const handleLinkContact = async (contactId: string) => {
    setLinkBusy(true)
    setLinkError('')
    const result = await addContactCustomerLink(contactId, customerId)
    setLinkBusy(false)
    if (result.error) {
      setLinkError(result.error)
    } else {
      setShowLinkPicker(false)
      setLinkSearch('')
      setLinkResults([])
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
          {r.is_shipping && <Badge label="Shipping" color="#0284c7" bg="#f0f9ff" />}
          {r.is_portal_admin && <Badge label="Admin" color="#dc2626" bg="#fef2f2" />}
          {r.is_portal_user && <Badge label="Portal" color="#d97706" bg="#fffbeb" />}
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
    <CollapsibleCard
      title="Contacts"
      count={contacts.length}
      actions={
        <div className="flex items-center gap-2">
          <div ref={aiDropdownRef} className="relative flex">
            <button
              type="button"
              onClick={() => setAiModalMode('screenshot')}
              className="inline-flex items-center gap-1.5 rounded-l-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              AI Add
            </button>
            <button
              type="button"
              onClick={() => setShowAiDropdown((v) => !v)}
              className="inline-flex items-center rounded-r-lg border border-l-0 border-purple-200 bg-purple-50 px-1.5 py-1.5 text-purple-500 hover:bg-purple-100"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAiDropdown && (
              <div className="absolute right-0 z-20 mt-1 top-full w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => { setShowAiDropdown(false); setAiModalMode('screenshot') }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-sm font-medium text-slate-700">From Screenshot</span>
                  <span className="block text-xs text-slate-400">Email sig, business card, website</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAiDropdown(false); setAiModalMode('paste') }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-sm font-medium text-slate-700">From Email / Text</span>
                  <span className="block text-xs text-slate-400">Paste signature or contact details</span>
                </button>
              </div>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowLinkPicker(true)}>+ Add Existing</Button>
          <Button size="sm" variant="primary" onClick={openAdd}>+ New Contact</Button>
        </div>
      }
    >
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
              <Checkbox
                label="Shipping contact"
                checked={form.is_shipping}
                onChange={(v) => setForm((f) => ({ ...f, is_shipping: v }))}
              />
              <Checkbox
                label="Portal admin"
                checked={form.is_portal_admin}
                onChange={(v) => setForm((f) => ({ ...f, is_portal_admin: v, ...(v ? { is_portal_user: false } : {}) }))}
              />
              <Checkbox
                label="Portal user"
                checked={form.is_portal_user}
                onChange={(v) => setForm((f) => ({ ...f, is_portal_user: v }))}
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
      {aiModalMode && (
        <AiContactModal
          customerId={customerId}
          initialMode={aiModalMode}
          isFirstContact={contacts.length === 0}
          onClose={() => setAiModalMode(null)}
        />
      )}
      {showLinkPicker && (
        <Modal title="Add Existing Contact" onClose={() => { setShowLinkPicker(false); setLinkSearch(''); setLinkResults([]); setLinkError('') }} width={480}>
          <p className="text-sm text-slate-500 mb-3">
            Search for a contact from another company to link them to this customer.
          </p>
          {linkError && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-sm text-red-700">{linkError}</div>
          )}
          <input
            type="text"
            value={linkSearch}
            onChange={e => handleLinkSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            autoFocus
          />
          {linkSearching && <p className="mt-2 text-xs text-slate-400">Searching...</p>}
          {linkResults.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {linkResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleLinkContact(r.id)}
                  disabled={linkBusy}
                  className="flex w-full items-center justify-between py-2.5 px-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded disabled:opacity-50"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.first_name} {r.last_name}
                    </span>
                    {r.email && <span className="ml-2 text-xs text-slate-400">{r.email}</span>}
                    <div className="text-xs text-slate-400">From: {r.customer_name}</div>
                  </div>
                  <span className="text-xs text-indigo-600 font-medium shrink-0">Link</span>
                </button>
              ))}
            </div>
          )}
          {linkSearch.length >= 2 && !linkSearching && linkResults.length === 0 && (
            <p className="mt-3 text-sm text-slate-400">No contacts found.</p>
          )}
        </Modal>
      )}
    </CollapsibleCard>
  )
}
