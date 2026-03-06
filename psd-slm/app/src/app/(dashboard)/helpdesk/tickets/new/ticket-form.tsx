'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
import { createTicket, getContactsForCustomer } from '../../actions'

interface TicketFormProps {
  customers: { id: string; name: string }[]
  categories: { id: string; name: string; parent_id: string | null }[]
  tags: { id: string; name: string; color: string }[]
  teamMembers: { id: string; first_name: string; last_name: string; initials: string | null }[]
  brands: { id: string; name: string }[]
}

export function TicketForm({ customers, categories, tags, teamMembers, brands }: TicketFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string; email: string | null }[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const [form, setForm] = useState({
    customer_id: '',
    contact_id: '',
    assigned_to: '',
    brand_id: '',
    category_id: '',
    subject: '',
    description: '',
    ticket_type: 'helpdesk',
    priority: 'medium',
    site_location: '',
    room_number: '',
    device_details: '',
    scheduled_date: '',
  })

  // Load contacts when customer changes
  useEffect(() => {
    if (form.customer_id) {
      getContactsForCustomer(form.customer_id).then(data => {
        setContacts(data)
        setForm(prev => ({ ...prev, contact_id: '' }))
      })
    } else {
      setContacts([])
    }
  }, [form.customer_id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const result = await createTicket({
        customer_id: form.customer_id,
        contact_id: form.contact_id || undefined,
        assigned_to: form.assigned_to || undefined,
        brand_id: form.brand_id || undefined,
        category_id: form.category_id || undefined,
        subject: form.subject,
        description: form.description || undefined,
        ticket_type: form.ticket_type || undefined,
        priority: form.priority || undefined,
        site_location: form.site_location || undefined,
        room_number: form.room_number || undefined,
        device_details: form.device_details || undefined,
        scheduled_date: form.scheduled_date || undefined,
        tag_ids: selectedTags.length > 0 ? selectedTags : undefined,
      })

      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        router.push(`/helpdesk/tickets/${result.data.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  // Build hierarchical category options
  const topCategories = categories.filter(c => !c.parent_id)
  const childCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Company & Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchableSelect
            label="Company"
            required
            value={form.customer_id}
            options={customers.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Search companies..."
            onChange={(val) => setForm({ ...form, customer_id: val })}
          />
          <SearchableSelect
            label="Contact"
            value={form.contact_id}
            options={contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}${c.email ? ` (${c.email})` : ''}` }))}
            placeholder="Search contacts..."
            onChange={(val) => setForm({ ...form, contact_id: val })}
            disabled={!form.customer_id}
          />
        </div>

        {/* Subject */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Subject *</label>
          <input
            type="text"
            value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
            required
            placeholder="Brief description of the issue"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={5}
            placeholder="Detailed description of the issue..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Priority, Category, Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <SearchableSelect
            label="Category"
            value={form.category_id}
            options={topCategories.flatMap(cat => [
              { value: cat.id, label: cat.name },
              ...childCategories(cat.id).map(child => ({ value: child.id, label: `  ${child.name}` })),
            ])}
            placeholder="Search categories..."
            onChange={(val) => setForm({ ...form, category_id: val })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Ticket Type</label>
            <select
              value={form.ticket_type}
              onChange={e => setForm({ ...form, ticket_type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="helpdesk">Service Desk</option>
              <option value="onsite_job">Onsite Job</option>
            </select>
          </div>
        </div>

        {/* Assignment, Brand */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchableSelect
            label="Assign To"
            value={form.assigned_to}
            options={teamMembers.map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))}
            placeholder="Search team members..."
            onChange={(val) => setForm({ ...form, assigned_to: val })}
          />
          <SearchableSelect
            label="Brand"
            value={form.brand_id}
            options={brands.map(b => ({ value: b.id, label: b.name }))}
            placeholder="Search brands..."
            onChange={(val) => setForm({ ...form, brand_id: val })}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setSelectedTags(prev =>
                  prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                )}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedTags.includes(tag.id)
                    ? 'ring-2 ring-indigo-500 ring-offset-1'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: tag.color + '20', color: tag.color }}
              >
                {tag.name}
              </button>
            ))}
            {tags.length === 0 && (
              <span className="text-xs text-slate-400">No tags available</span>
            )}
          </div>
        </div>

        {/* Onsite job fields */}
        {form.ticket_type === 'onsite_job' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-amber-800">Onsite Job Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Site Location</label>
                <input
                  type="text"
                  value={form.site_location}
                  onChange={e => setForm({ ...form, site_location: e.target.value })}
                  placeholder="Building/site name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Room Number</label>
                <input
                  type="text"
                  value={form.room_number}
                  onChange={e => setForm({ ...form, room_number: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Device Details</label>
                <input
                  type="text"
                  value={form.device_details}
                  onChange={e => setForm({ ...form, device_details: e.target.value })}
                  placeholder="Make/model/serial"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Scheduled Date</label>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/helpdesk')}
          className="rounded-lg border border-gray-300 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <Button
          variant="primary"
          type="submit"
          disabled={saving || !form.customer_id || !form.subject.trim()}
        >
          {saving ? 'Creating...' : 'Create Ticket'}
        </Button>
      </div>
    </form>
  )
}
