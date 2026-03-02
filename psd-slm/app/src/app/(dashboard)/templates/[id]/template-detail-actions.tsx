'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { deleteTemplate } from '../actions'
import { CloneToQuoteModal } from './clone-to-quote-modal'

interface TemplateDetailActionsProps {
  templateId: string
  templateName: string
}

export function TemplateDetailActions({ templateId, templateName }: TemplateDetailActionsProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canEdit = hasPermission('templates', 'edit')
  const canDelete = hasPermission('templates', 'delete')
  const canCreateQuote = hasPermission('quotes', 'create')

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteTemplate(templateId)
    setDeleting(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.push('/templates')
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canCreateQuote && (
          <Button size="sm" variant="primary" onClick={() => setShowCloneModal(true)}>
            Use Template
          </Button>
        )}
        {canEdit && (
          <Button size="sm" variant="default" onClick={() => router.push(`/templates/${templateId}/edit`)}>
            Edit
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="danger" onClick={() => setShowDeleteModal(true)}>
            Delete
          </Button>
        )}
      </div>

      {/* Clone Modal */}
      {showCloneModal && (
        <CloneToQuoteModal
          templateId={templateId}
          templateName={templateName}
          onClose={() => setShowCloneModal(false)}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal title="Delete Template" onClose={() => setShowDeleteModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to delete <strong>{templateName}</strong>? The template will be deactivated.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Template'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
