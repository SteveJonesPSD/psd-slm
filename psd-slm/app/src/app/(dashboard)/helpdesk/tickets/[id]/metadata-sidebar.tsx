'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeTicketStatus, silentCloseTicket, assignTicket, updateTicketField, addTag, removeTag } from '../../actions'
import { SearchableSelect } from '@/components/ui/form-fields'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'
import { STATUS_TRANSITIONS } from '@/lib/helpdesk'
import type { TicketStatus } from '@/types/database'

interface MetadataSidebarProps {
  ticket: Record<string, unknown>
  teamMembers: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null }[]
  categories: { id: string; name: string; parent_id: string | null }[]
  tags: { id: string; name: string; color: string }[]
  currentTags: Record<string, unknown>[]
  departmentName: string | null
}

export function MetadataSidebar({ ticket, teamMembers, categories, tags, currentTags, departmentName }: MetadataSidebarProps) {
  const router = useRouter()
  const [showTagPicker, setShowTagPicker] = useState(false)

  const status = ticket.status as TicketStatus
  const availableTransitions = STATUS_TRANSITIONS[status] || []
  const assignedTags = currentTags as { id: string; name: string; color: string }[]
  const unassignedTags = tags.filter(t => !assignedTags.find(at => at.id === t.id))

  const [silentClosing, setSilentClosing] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  async function handleStatusChange(newStatus: string) {
    await changeTicketStatus(ticket.id as string, newStatus as TicketStatus)
    router.refresh()
  }

  async function handleSilentClose() {
    if (!confirm('Silent close this ticket? No notification will be sent.')) return
    setSilentClosing(true)
    await silentCloseTicket(ticket.id as string)
    setSilentClosing(false)
    router.refresh()
  }

  async function handleAssign(userId: string) {
    await assignTicket(ticket.id as string, userId || null)
    router.refresh()
  }

  async function handleFieldChange(field: string, value: string) {
    await updateTicketField(ticket.id as string, field, value || null)
    router.refresh()
  }

  async function handleToggleHoldOpen() {
    await updateTicketField(ticket.id as string, 'hold_open', !ticket.hold_open)
    router.refresh()
  }

  async function handleAddTag(tagId: string) {
    await addTag(ticket.id as string, tagId)
    setShowTagPicker(false)
    router.refresh()
  }

  async function handleRemoveTag(tagId: string) {
    await removeTag(ticket.id as string, tagId)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Details</h4>

      {/* Status */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
        <select
          value={status}
          onChange={e => handleStatusChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value={status}>{TICKET_STATUS_CONFIG[status]?.label || status}</option>
          {availableTransitions.map(s => (
            <option key={s} value={s}>{TICKET_STATUS_CONFIG[s]?.label || s}</option>
          ))}
        </select>
        {status !== 'closed' && status !== 'cancelled' && (
          <button
            onClick={handleSilentClose}
            disabled={silentClosing}
            className="mt-1.5 text-[11px] text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            {silentClosing ? 'Closing...' : 'Silent Close'}
          </button>
        )}
      </div>

      {/* Hold Open */}
      {status !== 'closed' && status !== 'cancelled' && (
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-500">Hold Open</label>
            <button
              type="button"
              role="switch"
              aria-checked={!!ticket.hold_open}
              onClick={handleToggleHoldOpen}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                ticket.hold_open ? 'bg-amber-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                  ticket.hold_open ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {ticket.hold_open ? (
            <p className="mt-1 text-[11px] text-amber-600">Ticket exempt from auto-close</p>
          ) : ticket.waiting_since && status === 'waiting_on_customer' ? (
            <p className="mt-1 text-[11px] text-slate-400">
              Waiting since {new Date(ticket.waiting_since as string).toLocaleString('en-GB')}
            </p>
          ) : null}
        </div>
      )}

      {/* Priority */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
        <select
          value={ticket.priority as string}
          onChange={e => handleFieldChange('priority', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {['urgent', 'high', 'medium', 'low'].map(p => (
            <option key={p} value={p}>{TICKET_PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>
      </div>

      {/* Assigned To */}
      <SearchableSelect
        label="Assigned To"
        value={ticket.assigned_to as string || ''}
        options={teamMembers.map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))}
        placeholder="Search agents..."
        onChange={handleAssign}
      />

      {/* Category */}
      <SearchableSelect
        label="Category"
        value={String(ticket.category_id ?? '')}
        options={categories.filter(c => !c.parent_id).flatMap(cat => [
          { value: cat.id, label: cat.name },
          ...categories.filter(c => c.parent_id === cat.id).map(child => ({ value: child.id, label: `  ${child.name}` })),
        ])}
        placeholder="Search categories..."
        onChange={(val) => handleFieldChange('category_id', val)}
      />

      {/* Department */}
      {departmentName && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            {departmentName}
          </span>
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {assignedTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-0.5 hover:opacity-70"
                style={{ color: tag.color }}
              >
                x
              </button>
            </span>
          ))}
          {assignedTags.length === 0 && (
            <span className="text-xs text-slate-300">No tags</span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowTagPicker(!showTagPicker)}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            + Add tag
          </button>
          {showTagPicker && unassignedTags.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-10 w-48 rounded-lg border border-gray-200 bg-white shadow-lg max-h-40 overflow-y-auto">
              {unassignedTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleAddTag(tag.id)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Customer</span>
          {(ticket.customers as Record<string, unknown>)?.name ? (
            <span className="text-slate-700 dark:text-slate-200 font-medium">{(ticket.customers as Record<string, unknown>).name as string}</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 font-medium">Needs customer assignment</span>
          )}
        </div>
        {ticket.contacts ? (
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Contact</span>
            <span className="text-slate-700">{(ticket.contacts as Record<string, unknown>).first_name as string} {(ticket.contacts as Record<string, unknown>).last_name as string}</span>
          </div>
        ) : null}
        {ticket.ticket_type === 'onsite_job' ? (
          <>
            {ticket.site_location ? (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Site</span>
                <span className="text-slate-700">{ticket.site_location as string}</span>
              </div>
            ) : null}
            {ticket.scheduled_date ? (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Scheduled</span>
                <span className="text-slate-700">{new Date(ticket.scheduled_date as string).toLocaleDateString('en-GB')}</span>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Created</span>
          <span className="text-slate-700">{new Date(ticket.created_at as string).toLocaleString('en-GB')}</span>
        </div>
      </div>

      {/* Magic Link */}
      {ticket.portal_token ? (
        <div className="border-t border-gray-100 pt-3 flex gap-2">
          <button
            onClick={() => {
              const url = `${window.location.origin}/t/${ticket.portal_token}`
              navigator.clipboard.writeText(url)
              setLinkCopied(true)
              setTimeout(() => setLinkCopied(false), 2000)
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-gray-50"
          >
            {linkCopied ? (
              <>
                <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.28" />
                </svg>
                Copy Magic Link
              </>
            )}
          </button>
          {(ticket.contacts as Record<string, unknown> | null)?.email ? (
            <button
              onClick={() => {
                const contact = ticket.contacts as Record<string, unknown>
                const email = contact.email as string
                const name = `${contact.first_name} ${contact.last_name}`
                const portalUrl = `${window.location.origin}/t/${ticket.portal_token}`
                const subject = `Your support ticket ${ticket.ticket_number} — ${ticket.subject}`
                const body = [
                  `Hi ${contact.first_name},`,
                  '',
                  `You can view and reply to your support ticket (${ticket.ticket_number}) using the link below. This also lets you upload photos from your phone.`,
                  '',
                  portalUrl,
                  '',
                  'Kind regards,',
                  'PSD Group Support',
                ].join('\n')
                window.location.href = `mailto:${encodeURIComponent(name)} <${email}>?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
              }}
              className="flex items-center justify-center rounded-lg border border-gray-300 px-2.5 py-2 text-slate-600 hover:bg-gray-50"
              title={`Email magic link to ${(ticket.contacts as Record<string, unknown>).first_name} ${(ticket.contacts as Record<string, unknown>).last_name}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
