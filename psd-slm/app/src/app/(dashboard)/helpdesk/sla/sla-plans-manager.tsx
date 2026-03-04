'use client'

import { useState } from 'react'
import { createSlaPlan, updateSlaPlan, deleteSlaPlan } from '../actions'
import { Badge } from '@/components/ui/badge'

interface SlaPlanRow {
  id: string
  name: string
  description: string | null
  business_hours_start: string
  business_hours_end: string
  business_days: number[]
  is_24x7: boolean
  is_default: boolean
  is_active: boolean
  sla_plan_targets: {
    id: string
    priority: string
    response_time_minutes: number
    resolution_time_minutes: number
  }[]
}

const DEFAULT_TARGETS = [
  { priority: 'urgent', response_time_minutes: 30, resolution_time_minutes: 240 },
  { priority: 'high', response_time_minutes: 60, resolution_time_minutes: 480 },
  { priority: 'medium', response_time_minutes: 240, resolution_time_minutes: 1440 },
  { priority: 'low', response_time_minutes: 480, resolution_time_minutes: 2880 },
]

function minutesToDisplay(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function SlaPlansManager({ initialData }: { initialData: SlaPlanRow[] }) {
  const [plans, setPlans] = useState(initialData)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SlaPlanRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    business_hours_start: '08:00',
    business_hours_end: '17:30',
    business_days: [1, 2, 3, 4, 5] as number[],
    is_24x7: false,
    is_default: false,
    targets: DEFAULT_TARGETS.map(t => ({ ...t })),
  })

  function openCreate() {
    setEditing(null)
    setForm({
      name: '',
      description: '',
      business_hours_start: '08:00',
      business_hours_end: '17:30',
      business_days: [1, 2, 3, 4, 5],
      is_24x7: false,
      is_default: false,
      targets: DEFAULT_TARGETS.map(t => ({ ...t })),
    })
    setShowForm(true)
  }

  function openEdit(plan: SlaPlanRow) {
    setEditing(plan)
    setForm({
      name: plan.name,
      description: plan.description || '',
      business_hours_start: plan.business_hours_start || '08:00',
      business_hours_end: plan.business_hours_end || '17:30',
      business_days: plan.business_days || [1, 2, 3, 4, 5],
      is_24x7: plan.is_24x7,
      is_default: plan.is_default,
      targets: ['urgent', 'high', 'medium', 'low'].map(p => {
        const existing = plan.sla_plan_targets.find(t => t.priority === p)
        return existing
          ? { priority: p, response_time_minutes: existing.response_time_minutes, resolution_time_minutes: existing.resolution_time_minutes }
          : DEFAULT_TARGETS.find(t => t.priority === p)!
      }),
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const result = await updateSlaPlan(editing.id, {
          name: form.name,
          description: form.description || null,
          business_hours_start: form.business_hours_start,
          business_hours_end: form.business_hours_end,
          business_days: form.business_days,
          is_24x7: form.is_24x7,
          is_default: form.is_default,
          targets: form.targets,
        })
        if (!result.error) {
          setPlans(prev => prev.map(p => p.id === editing.id ? {
            ...p,
            name: form.name,
            description: form.description || null,
            business_hours_start: form.business_hours_start,
            business_hours_end: form.business_hours_end,
            business_days: form.business_days,
            is_24x7: form.is_24x7,
            is_default: form.is_default,
            sla_plan_targets: form.targets.map(t => ({ ...t, id: '' })),
          } : (form.is_default ? { ...p, is_default: false } : p)))
        }
      } else {
        const result = await createSlaPlan({
          name: form.name,
          description: form.description || undefined,
          business_hours_start: form.business_hours_start,
          business_hours_end: form.business_hours_end,
          business_days: form.business_days,
          is_24x7: form.is_24x7,
          is_default: form.is_default,
          targets: form.targets,
        })
        if (result.data) {
          // Refresh to get full data
          window.location.reload()
        }
      }
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this SLA plan? This will affect any contracts using it.')) return
    const result = await deleteSlaPlan(id)
    if (!result.error) {
      setPlans(prev => prev.filter(p => p.id !== id))
    }
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  function toggleDay(day: number) {
    setForm(prev => ({
      ...prev,
      business_days: prev.business_days.includes(day)
        ? prev.business_days.filter(d => d !== day)
        : [...prev.business_days, day].sort(),
    }))
  }

  function updateTarget(priority: string, field: 'response_time_minutes' | 'resolution_time_minutes', value: number) {
    setForm(prev => ({
      ...prev,
      targets: prev.targets.map(t =>
        t.priority === priority ? { ...t, [field]: value } : t
      ),
    }))
  }

  if (showForm) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-6 text-lg font-semibold text-slate-900">
          {editing ? 'Edit SLA Plan' : 'New SLA Plan'}
        </h3>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Business Hours</label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={form.business_hours_start}
                onChange={e => setForm({ ...form, business_hours_start: e.target.value })}
                disabled={form.is_24x7}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
              <span className="text-sm text-slate-500">to</span>
              <input
                type="time"
                value={form.business_hours_end}
                onChange={e => setForm({ ...form, business_hours_end: e.target.value })}
                disabled={form.is_24x7}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Business Days</label>
            <div className="flex gap-1">
              {dayNames.map((name, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  disabled={form.is_24x7}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    form.business_days.includes(i)
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-400'
                  } ${form.is_24x7 ? 'opacity-50' : ''}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_24x7}
              onChange={e => setForm({ ...form, is_24x7: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-slate-700">24x7 Coverage</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={e => setForm({ ...form, is_default: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-slate-700">Default Plan</span>
          </label>
        </div>

        <div className="mt-6">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Response & Resolution Targets</h4>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">Priority</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">Response Time (mins)</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">Resolution Time (mins)</th>
                </tr>
              </thead>
              <tbody>
                {form.targets.map(t => (
                  <tr key={t.priority} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 font-medium capitalize text-slate-700">{t.priority}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={t.response_time_minutes}
                        onChange={e => updateTarget(t.priority, 'response_time_minutes', parseInt(e.target.value) || 0)}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        min={1}
                      />
                      <span className="ml-2 text-xs text-slate-400">{minutesToDisplay(t.response_time_minutes)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={t.resolution_time_minutes}
                        onChange={e => updateTarget(t.priority, 'resolution_time_minutes', parseInt(e.target.value) || 0)}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        min={1}
                      />
                      <span className="ml-2 text-xs text-slate-400">{minutesToDisplay(t.resolution_time_minutes)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowForm(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing ? 'Update Plan' : 'Create Plan'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add SLA Plan
        </button>
      </div>

      <div className="space-y-4">
        {plans.map(plan => (
          <div key={plan.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                  {plan.is_default && <Badge label="Default" color="#6366f1" bg="#eef2ff" />}
                  {plan.is_24x7 && <Badge label="24x7" color="#dc2626" bg="#fef2f2" />}
                  {!plan.is_active && <Badge label="Inactive" color="#6b7280" bg="#f3f4f6" />}
                </div>
                {plan.description && (
                  <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {plan.is_24x7
                    ? 'Coverage: 24 hours, 7 days a week'
                    : `Hours: ${plan.business_hours_start}–${plan.business_hours_end} | Days: ${(plan.business_days || []).map(d => dayNames[d]).join(', ')}`
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(plan)} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                <button onClick={() => handleDelete(plan.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            </div>

            {plan.sla_plan_targets.length > 0 && (
              <div className="mt-4 grid grid-cols-4 gap-3">
                {['urgent', 'high', 'medium', 'low'].map(p => {
                  const target = plan.sla_plan_targets.find(t => t.priority === p)
                  if (!target) return null
                  return (
                    <div key={p} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                      <div className="text-xs font-medium uppercase text-slate-400">{p}</div>
                      <div className="mt-1 text-sm text-slate-700">
                        Response: <span className="font-medium">{minutesToDisplay(target.response_time_minutes)}</span>
                      </div>
                      <div className="text-sm text-slate-700">
                        Resolution: <span className="font-medium">{minutesToDisplay(target.resolution_time_minutes)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {plans.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-slate-400">
            No SLA plans yet. Click &quot;Add SLA Plan&quot; to create one.
          </div>
        )}
      </div>
    </div>
  )
}
