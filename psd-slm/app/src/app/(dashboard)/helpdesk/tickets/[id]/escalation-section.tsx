'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
import { escalateTicket } from '../../actions'

interface DepartmentOption {
  id: string
  name: string
  escalation_type: string
  priority_uplift: number
}

interface EscalationSectionProps {
  ticketId: string
  escalationLevel: number
  currentDepartment: { id: string; name: string } | null
  teamMembers: { id: string; first_name: string; last_name: string }[]
  departments: DepartmentOption[]
}

export function EscalationSection({ ticketId, escalationLevel, currentDepartment, teamMembers, departments }: EscalationSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ reason: '', assign_to: '', department_id: '' })

  const selectedDept = departments.find(d => d.id === form.department_id)

  function getButtonText() {
    if (saving) return 'Escalating...'
    if (selectedDept) {
      if (selectedDept.escalation_type === 'sideways') {
        return `Route to ${selectedDept.name}`
      }
      return `Escalate to L${escalationLevel + 1} (${selectedDept.name})`
    }
    return `Escalate to L${escalationLevel + 1}`
  }

  async function handleEscalate() {
    if (!form.reason.trim()) return
    setSaving(true)
    try {
      await escalateTicket(ticketId, {
        reason: form.reason.trim(),
        assign_to: form.assign_to || undefined,
        department_id: form.department_id || undefined,
      })
      setForm({ reason: '', assign_to: '', department_id: '' })
      setShowForm(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Escalation</h4>
        <span className={`text-xs font-medium ${escalationLevel > 0 ? 'text-red-600' : 'text-slate-400'}`}>
          Level {escalationLevel}
        </span>
      </div>

      {currentDepartment && (
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Department:</span>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
            {currentDepartment.name}
          </span>
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-red-600 hover:text-red-800"
        >
          Escalate Ticket
        </button>
      ) : (
        <div className="space-y-2">
          {departments.length > 0 && (
            <div>
              <SearchableSelect
                size="sm"
                value={form.department_id}
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                placeholder="No department"
                onChange={val => setForm({ ...form, department_id: val })}
              />
              {selectedDept && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {selectedDept.escalation_type === 'sideways'
                    ? 'Sideways — no priority change'
                    : `Upward — priority +${selectedDept.priority_uplift}`}
                </p>
              )}
            </div>
          )}
          <textarea
            value={form.reason}
            onChange={e => setForm({ ...form, reason: e.target.value })}
            placeholder="Escalation reason..."
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <SearchableSelect
            size="sm"
            value={form.assign_to}
            options={teamMembers.map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))}
            placeholder="Keep current assignment"
            onChange={val => setForm({ ...form, assign_to: val })}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded px-3 py-1 text-xs text-slate-500 hover:bg-gray-50"
            >
              Cancel
            </button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleEscalate}
              disabled={saving || !form.reason.trim()}
            >
              {getButtonText()}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
