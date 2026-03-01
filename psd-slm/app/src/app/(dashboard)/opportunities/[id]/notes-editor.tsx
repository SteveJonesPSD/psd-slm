'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { updateNotes } from '@/app/(dashboard)/pipeline/actions'

interface NotesEditorProps {
  opportunityId: string
  initialNotes: string
}

export function NotesEditor({ opportunityId, initialNotes }: NotesEditorProps) {
  const router = useRouter()
  const { hasAnyPermission } = useAuth()

  const canEdit = hasAnyPermission([
    { module: 'pipeline', action: 'edit_all' },
    { module: 'pipeline', action: 'edit_own' },
  ])

  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateNotes(opportunityId, notes)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  const handleCancel = () => {
    setNotes(initialNotes)
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Notes</h3>
        {canEdit && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <>
          <Textarea
            value={notes}
            onChange={setNotes}
            rows={4}
            className="mb-3"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-600 whitespace-pre-wrap">
          {initialNotes || <span className="text-slate-400">No notes.</span>}
        </p>
      )}
    </div>
  )
}
