'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { deleteQuote, createRevision, duplicateQuote, addSupplierLinesToQuote, manuallyAcceptQuote } from '../actions'
import { SupplierQuoteModal, type MergeLinesData } from '../supplier-quote-modal'
import { SaveAsTemplateModal } from './save-as-template-modal'
import { AiAcceptModal } from './ai-accept-modal'
import { SendQuoteModal } from './send-quote-modal'
import type { Quote } from '@/types/database'

interface LinkedContract {
  id: string
  contract_number: string
  category: string
  esign_status: string
  status: string
}

interface QuoteDetailActionsProps {
  quote: Quote
  portalUrl: string | null
  existingSoId: string | null
  contact: { first_name: string; last_name: string; email: string | null } | null
  customer: { name: string } | null
  brand: { name: string } | null
  assignedUser: { id: string; first_name: string; last_name: string } | null
  subtotal: number
  zeroSellLines?: string[]
  linkedContracts?: LinkedContract[]
}

export function QuoteDetailActions({ quote, portalUrl, existingSoId, contact, customer, brand, assignedUser, subtotal, zeroSellLines = [], linkedContracts = [] }: QuoteDetailActionsProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [showSendModal, setShowSendModal] = useState(false)
  const [showResendModal, setShowResendModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false)
  const [showSupplierImport, setShowSupplierImport] = useState(false)
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [showAiAcceptModal, setShowAiAcceptModal] = useState(false)
  const [acceptPo, setAcceptPo] = useState('')
  const [revisionNotes, setRevisionNotes] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [acting, setActing] = useState(false)

  const canEdit = hasPermission('quotes', 'edit_all') || hasPermission('quotes', 'edit_own')
  const canDelete = hasPermission('quotes', 'delete')
  const canCreate = hasPermission('quotes', 'create')
  const canCreateTemplate = hasPermission('templates', 'create')

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteQuote(quote.id)
    setDeleting(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      router.push('/quotes')
    }
  }

  const handleDuplicate = async () => {
    setActing(true)
    const result = await duplicateQuote(quote.id)
    setActing(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else if ('data' in result && result.data) {
      router.push(`/quotes/${result.data.id}/edit`)
    }
  }

  const handleEdit = () => {
    // Draft/review: direct edit. Sent/declined: confirm revision first.
    if (['draft', 'review'].includes(quote.status)) {
      router.push(`/quotes/${quote.id}/edit`)
    } else if (['sent', 'declined'].includes(quote.status) && canCreate) {
      setShowRevisionModal(true)
    }
  }

  const handleConfirmRevision = async () => {
    setActing(true)
    const result = await createRevision(quote.id, revisionNotes)
    setActing(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else if ('data' in result && result.data) {
      setShowRevisionModal(false)
      setRevisionNotes('')
      router.push(`/quotes/${result.data.id}/edit`)
    }
  }

  const handleAcceptQuote = async () => {
    setAccepting(true)
    const result = await manuallyAcceptQuote(quote.id, acceptPo.trim() || undefined)
    setAccepting(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowAcceptModal(false)
      router.refresh()
    }
  }

  const handleDownloadPdf = () => {
    window.open(`/api/quotes/${quote.id}/pdf`, '_blank')
  }

  const handleMergeSupplierLines = async (data: MergeLinesData) => {
    const result = await addSupplierLinesToQuote({
      quoteId: quote.id,
      groupName: data.groupName,
      supplierId: data.supplierId,
      newSupplierName: data.newSupplierName,
      lines: data.lines.map((l) => ({
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        buy_price: l.buy_price,
        sell_price: l.sell_price,
        supplier_id: l.supplier_id,
        product_code: null,
        manufacturer_part: null,
      })),
      pdfStoragePath: data.pdfStoragePath,
      pdfFileName: data.pdfFileName,
    })

    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowSupplierImport(false)
      router.refresh()
    }
  }

  // Edit button visible for: draft, review (direct edit) AND sent, declined (revision). Not accepted.
  const showEditButton = canEdit && ['draft', 'review', 'sent', 'declined'].includes(quote.status)

  return (
    <>
      <div className="flex items-center gap-2">
        {/* AI Quote — add supplier lines, only for draft/review */}
        {canEdit && ['draft', 'review'].includes(quote.status) && (
          <Button
            size="sm"
            variant="purple"
            onClick={() => setShowSupplierImport(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            AI Quote
          </Button>
        )}

        {/* Send to Customer — only for draft/review */}
        {canEdit && ['draft', 'review'].includes(quote.status) && (
          <Button
            size="sm"
            variant="success"
            onClick={() => setShowSendModal(true)}
          >
            Send to Customer
          </Button>
        )}

        {/* Resend — only for sent quotes */}
        {canEdit && quote.status === 'sent' && (
          <Button
            size="sm"
            variant="blue"
            onClick={() => setShowResendModal(true)}
          >
            Resend
          </Button>
        )}

        {/* Accept Quote — only for sent quotes */}
        {canEdit && quote.status === 'sent' && (
          <Button
            size="sm"
            variant="success"
            onClick={() => setShowAcceptModal(true)}
          >
            Accept Quote
          </Button>
        )}

        {/* AI Accept — only for sent quotes */}
        {canEdit && quote.status === 'sent' && (
          <Button
            size="sm"
            variant="purple"
            onClick={() => setShowAiAcceptModal(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            AI Accept
          </Button>
        )}

        {/* PDF — not shown for accepted quotes */}
        {quote.status !== 'accepted' && (
          <Button size="sm" variant="default" onClick={handleDownloadPdf}>
            PDF
          </Button>
        )}

        {/* Create / View Sales Order — only for acknowledged accepted quotes */}
        {canEdit && quote.status === 'accepted' && quote.acknowledged_at && !existingSoId && (() => {
          const unsignedContract = linkedContracts.find(
            c => ['service', 'licensing'].includes(c.category) && c.esign_status === 'pending'
          )
          if (unsignedContract) {
            return (
              <span title={`Sales order creation is pending contract e-signature on ${unsignedContract.contract_number}`}>
                <Button size="sm" variant="blue" disabled>
                  Create Sales Order
                </Button>
              </span>
            )
          }
          return (
            <Button
              size="sm"
              variant="blue"
              onClick={() => router.push(`/orders/new?quote_id=${quote.id}`)}
            >
              Create Sales Order
            </Button>
          )
        })()}
        {quote.status === 'accepted' && existingSoId && (
          <Button
            size="sm"
            variant="blue"
            onClick={() => router.push(`/orders/${existingSoId}`)}
          >
            View Sales Order
          </Button>
        )}

        {/* Duplicate */}
        {canCreate && (
          <Button
            size="sm"
            variant="default"
            onClick={handleDuplicate}
            disabled={acting}
          >
            Duplicate
          </Button>
        )}

        {/* Save as Template */}
        {canCreateTemplate && (
          <Button
            size="sm"
            variant="default"
            onClick={() => setShowSaveAsTemplate(true)}
          >
            Save as Template
          </Button>
        )}

        {/* Delete — only for draft */}
        {canDelete && quote.status === 'draft' && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
        )}
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <SendQuoteModal
          quote={quote}
          contact={contact}
          customer={customer}
          brand={brand}
          assignedUser={assignedUser}
          portalUrl={portalUrl}
          subtotal={subtotal}
          zeroSellLines={zeroSellLines}
          onClose={() => setShowSendModal(false)}
        />
      )}

      {/* Resend Modal */}
      {showResendModal && (
        <SendQuoteModal
          quote={quote}
          contact={contact}
          customer={customer}
          brand={brand}
          assignedUser={assignedUser}
          portalUrl={portalUrl}
          subtotal={subtotal}
          zeroSellLines={zeroSellLines}
          isResend
          onClose={() => setShowResendModal(false)}
        />
      )}

      {/* Revision Confirmation Modal */}
      {showRevisionModal && (
        <Modal title="Create New Revision" onClose={() => { setShowRevisionModal(false); setRevisionNotes('') }}>
          <p className="text-sm text-slate-600 mb-4">
            This quote is currently <strong>{quote.status}</strong>. Editing will create a new revision
            (v{quote.version + 1}) and mark this version as revised. Continue?
          </p>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Revision Notes <span className="text-xs text-slate-400">(optional)</span>
            </label>
            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Why is this revision being created?"
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => { setShowRevisionModal(false); setRevisionNotes('') }}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleConfirmRevision} disabled={acting}>
              {acting ? 'Creating...' : 'Create Revision & Edit'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal title="Delete Quote" onClose={() => setShowDeleteModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to delete <strong>{quote.quote_number}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Quote'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Save as Template Modal */}
      {showSaveAsTemplate && (
        <SaveAsTemplateModal
          quoteId={quote.id}
          defaultName={quote.quote_number}
          onClose={() => setShowSaveAsTemplate(false)}
        />
      )}

      {/* Accept Quote Modal */}
      {showAcceptModal && (
        <Modal title="Accept Quote" onClose={() => setShowAcceptModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Mark <strong>{quote.quote_number}</strong> as accepted. This will auto-acknowledge and allow
            Sales Order creation.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Customer PO Number <span className="text-xs text-slate-400">(optional — can add later)</span>
            </label>
            <input
              type="text"
              value={acceptPo}
              onChange={(e) => setAcceptPo(e.target.value)}
              placeholder="e.g. PO-12345"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => setShowAcceptModal(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="success" onClick={handleAcceptQuote} disabled={accepting}>
              {accepting ? 'Accepting...' : 'Accept Quote'}
            </Button>
          </div>
        </Modal>
      )}

      {/* AI Accept Modal */}
      {showAiAcceptModal && (
        <AiAcceptModal
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          onClose={() => setShowAiAcceptModal(false)}
        />
      )}

      {/* AI Quote — Supplier Import Modal */}
      <SupplierQuoteModal
        open={showSupplierImport}
        onClose={() => setShowSupplierImport(false)}
        mode="merge"
        existingQuoteId={quote.id}
        onMergeLines={handleMergeSupplierLines}
      />
    </>
  )
}

// --- Bottom Edit Button (rendered at foot of quote page) ---

interface QuoteBottomEditProps {
  quoteId: string
  status: string
  version: number
}

export function QuoteBottomEdit({ quoteId, status, version }: QuoteBottomEditProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [showRevision, setShowRevision] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [acting, setActing] = useState(false)

  const canEdit = hasPermission('quotes', 'edit_all') || hasPermission('quotes', 'edit_own')
  const canCreate = hasPermission('quotes', 'create')
  const showEdit = canEdit && ['draft', 'review', 'sent', 'declined'].includes(status)

  if (!showEdit) return null

  const handleEdit = () => {
    if (['draft', 'review'].includes(status)) {
      router.push(`/quotes/${quoteId}/edit`)
    } else if (['sent', 'declined'].includes(status) && canCreate) {
      setShowRevision(true)
    }
  }

  const handleConfirmRevision = async () => {
    setActing(true)
    const result = await createRevision(quoteId, revisionNotes)
    setActing(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else if ('data' in result && result.data) {
      setShowRevision(false)
      setRevisionNotes('')
      router.push(`/quotes/${result.data.id}/edit`)
    }
  }

  const label = ['sent', 'declined'].includes(status) ? 'Create Revision & Edit' : 'Edit Quote'

  return (
    <>
      <div className="mt-8 flex justify-end">
        <Button size="sm" variant="primary" onClick={handleEdit} disabled={acting}>
          {label}
        </Button>
      </div>

      {showRevision && (
        <Modal title="Create New Revision" onClose={() => { setShowRevision(false); setRevisionNotes('') }}>
          <p className="text-sm text-slate-600 mb-4">
            This quote is currently <strong>{status}</strong>. Editing will create a new revision
            (v{version + 1}) and mark this version as revised. Continue?
          </p>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Revision Notes <span className="text-xs text-slate-400">(optional)</span>
            </label>
            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Why is this revision being created?"
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="default" onClick={() => { setShowRevision(false); setRevisionNotes('') }}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleConfirmRevision} disabled={acting}>
              {acting ? 'Creating...' : 'Create Revision & Edit'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
