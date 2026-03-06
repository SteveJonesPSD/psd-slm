'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCustomerContract } from '../actions'
import { Button } from '@/components/ui/button'

interface ContractNotesSectionProps {
  contractId: string
  notes: string | null
  editable: boolean
}

export function ContractNotesSection({ contractId, notes, editable }: ContractNotesSectionProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(notes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const fd = new FormData()
    fd.append('notes', value)
    await updateCustomerContract(contractId, fd)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Notes</h3>
        {editable && !editing && (
          <button
            onClick={() => { setValue(notes || ''); setEditing(true) }}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <Button
              onClick={handleSave}
              variant="primary"
              size="sm"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600 whitespace-pre-wrap">
          {notes || 'No notes.'}
        </p>
      )}
    </div>
  )
}
