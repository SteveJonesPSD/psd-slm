'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { OPPORTUNITY_STAGE_CONFIG, ACTIVE_STAGES, type OpportunityStage } from '@/lib/opportunities'
import { StageChangeModal } from '@/app/(dashboard)/pipeline/stage-change-modal'
import { LostReasonModal } from '@/app/(dashboard)/pipeline/lost-reason-modal'
import { changeStage, deleteOpportunity } from '@/app/(dashboard)/pipeline/actions'
import type { Opportunity } from '@/types/database'
import Link from 'next/link'

interface OpportunityActionsProps {
  opportunity: Opportunity
}

export function OpportunityActions({ opportunity }: OpportunityActionsProps) {
  const router = useRouter()
  const { hasPermission, hasAnyPermission } = useAuth()

  const canEdit = hasAnyPermission([
    { module: 'pipeline', action: 'edit_all' },
    { module: 'pipeline', action: 'edit_own' },
  ])
  const canDelete = hasPermission('pipeline', 'delete')

  const [stageModal, setStageModal] = useState<OpportunityStage | null>(null)
  const [showLostModal, setShowLostModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isActive = !['won', 'lost'].includes(opportunity.stage)

  const handleStageConfirm = async (probability: number) => {
    if (!stageModal) return
    const result = await changeStage(opportunity.id, stageModal, probability)
    setStageModal(null)
    if (result && 'error' in result && result.error) {
      alert(result.error)
    }
    router.refresh()
  }

  const handleWon = async () => {
    const result = await changeStage(opportunity.id, 'won', 100)
    if (result && 'error' in result && result.error) {
      alert(result.error)
    }
    router.refresh()
  }

  const handleLostConfirm = async (reason: string, notes: string) => {
    const result = await changeStage(opportunity.id, 'lost', 0, reason + (notes ? `\n${notes}` : ''))
    setShowLostModal(false)
    if (result && 'error' in result && result.error) {
      alert(result.error)
    }
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this opportunity? This cannot be undone.')) return
    setDeleting(true)
    await deleteOpportunity(opportunity.id)
    router.push('/pipeline')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {canEdit && (
        <Link href={`/opportunities/${opportunity.id}/edit`}>
          <Button size="sm">Edit</Button>
        </Link>
      )}

      {canEdit && isActive && (
        <>
          {/* Stage change dropdown */}
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
            value=""
            onChange={(e) => {
              const stage = e.target.value as OpportunityStage
              if (stage) setStageModal(stage)
            }}
          >
            <option value="">Change Stage...</option>
            {ACTIVE_STAGES.filter((s) => s !== opportunity.stage).map((s) => (
              <option key={s} value={s}>
                {OPPORTUNITY_STAGE_CONFIG[s].label}
              </option>
            ))}
          </select>

          <Button size="sm" variant="success" onClick={handleWon}>
            Mark Won
          </Button>
          <Button size="sm" variant="danger" onClick={() => setShowLostModal(true)}>
            Mark Lost
          </Button>
        </>
      )}

      {canDelete && (
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      )}

      {/* Stage change modal */}
      {stageModal && (
        <StageChangeModal
          opportunityTitle={opportunity.title}
          fromStage={opportunity.stage as OpportunityStage}
          toStage={stageModal}
          onConfirm={handleStageConfirm}
          onClose={() => setStageModal(null)}
        />
      )}

      {/* Lost reason modal */}
      {showLostModal && (
        <LostReasonModal
          opportunityTitle={opportunity.title}
          onConfirm={handleLostConfirm}
          onClose={() => setShowLostModal(false)}
        />
      )}
    </div>
  )
}
