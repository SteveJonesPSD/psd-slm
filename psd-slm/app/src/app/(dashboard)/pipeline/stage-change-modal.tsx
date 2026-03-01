'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/form-fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OPPORTUNITY_STAGE_CONFIG, type OpportunityStage } from '@/lib/opportunities'

interface StageChangeModalProps {
  opportunityTitle: string
  fromStage: OpportunityStage
  toStage: OpportunityStage
  onConfirm: (probability: number) => void
  onClose: () => void
}

export function StageChangeModal({
  opportunityTitle,
  fromStage,
  toStage,
  onConfirm,
  onClose,
}: StageChangeModalProps) {
  const fromCfg = OPPORTUNITY_STAGE_CONFIG[fromStage]
  const toCfg = OPPORTUNITY_STAGE_CONFIG[toStage]
  const [probability, setProbability] = useState(String(toCfg.defaultProbability))

  return (
    <Modal title="Change Stage" onClose={onClose} width={420}>
      <p className="text-sm text-slate-500 mb-4">
        Move <span className="font-semibold text-slate-700">{opportunityTitle}</span>
      </p>

      <div className="flex items-center gap-3 mb-5">
        <Badge label={fromCfg.label} color={fromCfg.color} bg={fromCfg.bg} />
        <span className="text-slate-400">&rarr;</span>
        <Badge label={toCfg.label} color={toCfg.color} bg={toCfg.bg} />
      </div>

      <Input
        label="Probability (%)"
        type="number"
        min="0"
        max="100"
        value={probability}
        onChange={setProbability}
        className="mb-6"
      />

      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => onConfirm(Math.min(100, Math.max(0, Number(probability) || 0)))}
        >
          Confirm
        </Button>
      </div>
    </Modal>
  )
}
