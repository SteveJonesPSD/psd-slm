'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Select, Textarea } from '@/components/ui/form-fields'
import { Button } from '@/components/ui/button'
import { LOST_REASONS } from '@/lib/opportunities'

interface LostReasonModalProps {
  opportunityTitle: string
  onConfirm: (reason: string, notes: string) => void
  onClose: () => void
}

export function LostReasonModal({ opportunityTitle, onConfirm, onClose }: LostReasonModalProps) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <Modal title="Mark as Lost" onClose={onClose} width={480}>
      <p className="text-sm text-slate-500 mb-4">
        Why was <span className="font-semibold text-slate-700">{opportunityTitle}</span> lost?
      </p>

      <Select
        label="Reason"
        value={reason}
        onChange={setReason}
        placeholder="Select a reason..."
        options={LOST_REASONS.map((r) => ({ value: r, label: r }))}
        className="mb-4"
      />

      <Textarea
        label="Notes (optional)"
        value={notes}
        onChange={setNotes}
        placeholder="Any additional context..."
        rows={3}
        className="mb-6"
      />

      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          disabled={!reason}
          onClick={() => onConfirm(reason, notes)}
        >
          Mark Lost
        </Button>
      </div>
    </Modal>
  )
}
