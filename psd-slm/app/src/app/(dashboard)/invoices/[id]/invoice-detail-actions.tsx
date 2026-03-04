'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency } from '@/lib/utils'
import { sendInvoice, markInvoicePaid, voidInvoice, createCreditNote } from '../actions'

interface InvoiceDetailActionsProps {
  invoiceId: string
  status: string
  invoiceType: string
  invoiceNumber: string
  parentInvoiceId: string | null
  contactName?: string | null
  contactEmail?: string | null
  invoiceTotal?: number
  salesOrderId?: string | null
  lines: {
    salesOrderLineId: string
    description: string
    quantity: number
    unitPrice: number
    unitCost: number
    vatRate: number
    productId: string | null
    sortOrder: number
    groupName: string | null
  }[]
}

export function InvoiceDetailActions({
  invoiceId,
  status,
  invoiceType,
  invoiceNumber,
  contactName,
  contactEmail,
  invoiceTotal,
  salesOrderId,
  lines,
}: InvoiceDetailActionsProps) {
  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const [loading, setLoading] = useState('')
  const [showSendModal, setShowSendModal] = useState(false)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [showPaidModal, setShowPaidModal] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0])
  const [bccMe, setBccMe] = useState(true)
  const [bccAccounts, setBccAccounts] = useState(true)

  const canEdit = hasPermission('invoices', 'edit')
  const canCreate = hasPermission('invoices', 'create')

  const handleSend = async () => {
    setLoading('send')
    const result = await sendInvoice(invoiceId)
    setLoading('')
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowSendModal(false)
      router.refresh()
    }
  }

  const handleMarkPaid = async () => {
    setLoading('paid')
    const result = await markInvoicePaid(invoiceId, paidDate)
    setLoading('')
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowPaidModal(false)
      router.refresh()
    }
  }

  const handleVoid = async () => {
    setLoading('void')
    const result = await voidInvoice(invoiceId, voidReason)
    setLoading('')
    if ('error' in result && result.error) {
      alert(result.error)
    } else {
      setShowVoidModal(false)
      router.refresh()
    }
  }

  const handleCreditNote = async () => {
    setLoading('credit')
    const result = await createCreditNote({
      parentInvoiceId: invoiceId,
      lines: lines.map((l) => ({
        ...l,
      })),
    })
    setLoading('')
    if ('error' in result && result.error) {
      alert(result.error)
    } else if ('invoiceId' in result) {
      router.push(`/invoices/${result.invoiceId}`)
    }
  }

  const pdfUrl = `/api/invoices/${invoiceId}/pdf`

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* PDF download */}
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer text-sm px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          PDF
        </a>

        {/* Draft actions */}
        {status === 'draft' && canEdit && (
          <>
            <Button size="md" variant="ghost" onClick={() => router.push(`/invoices/${invoiceId}/edit`)}>
              Edit
            </Button>
            <Button size="md" variant="primary" onClick={() => setShowSendModal(true)}>
              Send to Customer
            </Button>
            <Button size="md" variant="danger" onClick={() => setShowVoidModal(true)}>
              Void
            </Button>
          </>
        )}

        {/* Sent / overdue actions */}
        {['sent', 'overdue'].includes(status) && canEdit && (
          <>
            <Button size="md" variant="success" onClick={() => setShowPaidModal(true)}>
              Mark as Paid
            </Button>
            {canCreate && invoiceType !== 'credit_note' && (
              <Button size="md" variant="default" onClick={() => setShowCreditModal(true)}>
                Credit Note
              </Button>
            )}
            <Button size="md" variant="danger" onClick={() => setShowVoidModal(true)}>
              Void
            </Button>
          </>
        )}

        {/* Paid actions */}
        {status === 'paid' && canCreate && invoiceType !== 'credit_note' && (
          <Button size="md" variant="default" onClick={() => setShowCreditModal(true)}>
            Credit Note
          </Button>
        )}

        {/* Void actions — re-raise options */}
        {status === 'void' && canCreate && salesOrderId && invoiceType !== 'credit_note' && (
          <>
            <Button
              size="md"
              variant="primary"
              onClick={() => router.push(`/orders/${salesOrderId}?action=reraise&invoiceId=${invoiceId}`)}
            >
              Re-raise Full Invoice
            </Button>
            <Button
              size="md"
              variant="default"
              onClick={() => router.push(`/orders/${salesOrderId}?action=partial`)}
            >
              Raise Partial Invoice
            </Button>
          </>
        )}
      </div>

      {/* Send to Customer confirmation modal */}
      {showSendModal && (
        <Modal title="Send Invoice to Customer" onClose={() => setShowSendModal(false)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-medium">{invoiceNumber}</span>
              </div>
              {invoiceTotal !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total:</span>
                  <span className="font-semibold">{formatCurrency(invoiceTotal)}</span>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Recipient</div>
              <div className="text-sm text-slate-700">
                {contactName || 'No contact set'}
                {contactEmail && <span className="text-slate-400 ml-1">({contactEmail})</span>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bccMe}
                  onChange={(e) => setBccMe(e.target.checked)}
                  className="rounded border-slate-300"
                />
                BCC me ({user?.email || 'my email'})
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bccAccounts}
                  onChange={(e) => setBccAccounts(e.target.checked)}
                  className="rounded border-slate-300"
                />
                BCC accounts team
              </label>
            </div>

            <p className="text-xs text-slate-400">
              Email integration coming soon. For now, this marks the invoice as sent and records your preferences.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={() => setShowSendModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSend} disabled={loading === 'send'}>
                {loading === 'send' ? 'Sending...' : 'Confirm & Send'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Void confirmation modal */}
      {showVoidModal && (
        <Modal title="Void Invoice" onClose={() => setShowVoidModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to void invoice <strong>{invoiceNumber}</strong>?
            This will reverse the invoiced quantities on the sales order lines.
          </p>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Reason for voiding <span className="text-red-500">*</span>
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${
                voidReason.trim().length > 0 && voidReason.trim().length < 5
                  ? 'border-red-300 focus:border-red-400'
                  : 'border-slate-200 focus:border-slate-400'
              }`}
              rows={2}
              placeholder="Reason for voiding (minimum 5 characters)..."
            />
            {voidReason.trim().length > 0 && voidReason.trim().length < 5 && (
              <p className="text-xs text-red-500 mt-1">Please enter at least 5 characters.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setShowVoidModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleVoid} disabled={loading === 'void' || voidReason.trim().length < 5}>
              {loading === 'void' ? 'Voiding...' : 'Void Invoice'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Mark as Paid modal */}
      {showPaidModal && (
        <Modal title="Mark as Paid" onClose={() => setShowPaidModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Enter the payment date for invoice <strong>{invoiceNumber}</strong>.
          </p>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">Payment Date</label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setShowPaidModal(false)}>Cancel</Button>
            <Button variant="success" onClick={handleMarkPaid} disabled={loading === 'paid'}>
              {loading === 'paid' ? 'Saving...' : 'Confirm Payment'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Credit Note confirmation modal */}
      {showCreditModal && (
        <Modal title="Raise Credit Note" onClose={() => setShowCreditModal(false)}>
          <p className="text-sm text-slate-600 mb-4">
            This will create a credit note for the full amount of invoice <strong>{invoiceNumber}</strong>.
            The credited quantities will be freed up for re-invoicing on the sales order.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setShowCreditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreditNote} disabled={loading === 'credit'}>
              {loading === 'credit' ? 'Creating...' : 'Create Credit Note'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
