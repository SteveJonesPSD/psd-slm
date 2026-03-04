'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortalTicket } from '@/lib/portal/actions'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
}

export function PortalTicketForm({ contact, categories, companyContacts }: {
  contact: { id: string; first_name: string; last_name: string; is_overseer: boolean }
  categories: { id: string; name: string }[]
  companyContacts: Contact[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    category_id: '',
    on_behalf_of: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData()
    formData.set('subject', form.subject)
    formData.set('description', form.description)
    formData.set('priority', form.priority)
    if (form.category_id) formData.set('category_id', form.category_id)
    if (form.on_behalf_of) formData.set('on_behalf_of', form.on_behalf_of)

    const result = await createPortalTicket(formData)
    if (result.error) {
      alert(result.error)
      setSaving(false)
      return
    }

    if (result.data) {
      router.push(`/portal/tickets/${result.data.id}`)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-900">New Support Ticket</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        {/* On behalf of (overseer only) */}
        {contact.is_overseer && companyContacts.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Raise on behalf of</label>
            <select
              value={form.on_behalf_of}
              onChange={e => setForm({ ...form, on_behalf_of: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Myself ({contact.first_name} {contact.last_name})</option>
              {companyContacts.filter(c => c.id !== contact.id).map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Subject *</label>
          <input
            type="text"
            value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
            required
            placeholder="Brief description of your issue"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description *</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            required
            rows={6}
            placeholder="Please provide as much detail as possible..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* KB suggestion placeholder */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-slate-500">
            Knowledge base suggestions coming soon — before submitting, check our{' '}
            <a href="/portal/knowledge-base" className="text-indigo-600 hover:text-indigo-800">
              Knowledge Base
            </a>{' '}
            for helpful articles.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            <select
              value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.subject.trim() || !form.description.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}
