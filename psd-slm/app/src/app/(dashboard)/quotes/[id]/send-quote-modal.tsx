'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { sendQuoteEmail, getUserMailCredential, getOrgMailCredentials } from '../send-actions'
import type { UserMailCredential } from '@/lib/email/types'
import { formatCurrency } from '@/lib/utils'

interface SendQuoteModalProps {
  quote: {
    id: string
    quote_number: string
    title: string | null
    status: string
    valid_until: string | null
    vat_rate: number
    assigned_to: string | null
    customer_id: string
  }
  contact: {
    first_name: string
    last_name: string
    email: string | null
  } | null
  customer: {
    name: string
  } | null
  brand: {
    name: string
  } | null
  assignedUser: {
    id: string
    first_name: string
    last_name: string
  } | null
  portalUrl: string | null
  subtotal: number
  zeroSellLines?: string[]
  isResend?: boolean
  onClose: () => void
}

type SendMethod = 'pdf' | 'portal'
type Step = 'method' | 'compose'

export function SendQuoteModal({
  quote,
  contact,
  customer,
  brand,
  assignedUser,
  portalUrl,
  subtotal,
  zeroSellLines = [],
  isResend = false,
  onClose,
}: SendQuoteModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('method')
  const [sendMethod, setSendMethod] = useState<SendMethod | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [zeroSellConfirmed, setZeroSellConfirmed] = useState(false)

  // Sender state
  const [assignedCred, setAssignedCred] = useState<UserMailCredential | null>(null)
  const [orgCreds, setOrgCreds] = useState<UserMailCredential[]>([])
  const [selectedSenderId, setSelectedSenderId] = useState<string>('')
  const [loadingCreds, setLoadingCreds] = useState(true)

  // Compose fields
  const [toField, setToField] = useState(
    contact?.email
      ? `${contact.first_name} ${contact.last_name} <${contact.email}>`
      : ''
  )
  const [ccField, setCcField] = useState('')
  const [bccField, setBccField] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState(
    isResend
      ? `Resend: Quote ${quote.quote_number}${quote.title ? ` — ${quote.title}` : ''} from ${brand?.name || 'PSD Group'}`
      : `Quote ${quote.quote_number}${quote.title ? ` — ${quote.title}` : ''} from ${brand?.name || 'PSD Group'}`
  )

  const validUntilFormatted = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const [messageBody, setMessageBody] = useState(
    isResend
      ? `Please find our reissued quotation ${quote.quote_number}${quote.title ? ` in respect of ${quote.title}` : ''} for ${customer?.name || ''}.

The total value is ${formatCurrency(subtotal)} (ex. VAT)${validUntilFormatted ? `, valid until ${validUntilFormatted}` : ''}.

Please don't hesitate to contact me if you have any questions.`
      : `Please find our quotation ${quote.quote_number}${quote.title ? ` in respect of ${quote.title}` : ''} for ${customer?.name || ''} as requested.

The total value is ${formatCurrency(subtotal)} (ex. VAT)${validUntilFormatted ? `, valid until ${validUntilFormatted}` : ''}.

Please don't hesitate to contact me if you have any questions.`
  )

  // Load credentials
  useEffect(() => {
    async function load() {
      try {
        const [assignedCredResult, orgCredsResult] = await Promise.all([
          quote.assigned_to ? getUserMailCredential(quote.assigned_to) : Promise.resolve(null),
          getOrgMailCredentials(),
        ])
        setAssignedCred(assignedCredResult)
        setOrgCreds(orgCredsResult)

        if (assignedCredResult) {
          setSelectedSenderId(assignedCredResult.user_id)
        } else if (orgCredsResult.length > 0) {
          setSelectedSenderId(orgCredsResult[0].user_id)
        }
      } finally {
        setLoadingCreds(false)
      }
    }
    load()
  }, [quote.assigned_to])

  const selectedCred = orgCreds.find(c => c.user_id === selectedSenderId) || assignedCred
  const hasZeroSellWarning = zeroSellLines.length > 0
  const canSend = selectedSenderId && toField.trim() && subject.trim() && sendMethod && (!hasZeroSellWarning || zeroSellConfirmed)

  const handleSelectMethod = (method: SendMethod) => {
    setSendMethod(method)
    setStep('compose')
  }

  const handleSend = async () => {
    if (!sendMethod || !selectedSenderId) return
    setError('')
    setSending(true)

    // Parse email addresses from the To field
    const toAddresses = parseEmailAddresses(toField)
    if (toAddresses.length === 0) {
      setError('Please enter at least one valid email address')
      setSending(false)
      return
    }

    const ccAddresses = parseEmailAddresses(ccField)
    const bccAddresses = parseEmailAddresses(bccField)

    const result = await sendQuoteEmail(quote.id, {
      sendMethod,
      toAddresses,
      ccAddresses,
      bccAddresses,
      subject,
      messageBody,
      senderUserId: selectedSenderId,
    })

    setSending(false)
    if (result.success) {
      onClose()
      router.refresh()
    } else {
      setError(result.error || 'Failed to send email')
    }
  }

  const title = isResend ? 'Resend Quote to Customer' : 'Send Quote to Customer'

  return (
    <Modal title={title} onClose={onClose} width={step === 'compose' ? 700 : 600}>
      {step === 'method' && (
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Choose how to send <strong>{quote.quote_number}</strong> to the customer.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* PDF option */}
            <button
              type="button"
              onClick={() => handleSelectMethod('pdf')}
              className="group rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-left hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                  </svg>
                </div>
                <span className="text-base font-semibold text-slate-900 dark:text-white">Send PDF</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Email the quote as a PDF attachment with a portal link to view, download, and accept online.
              </p>
            </button>

            {/* Portal link option */}
            <button
              type="button"
              onClick={() => handleSelectMethod('portal')}
              className="group rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-left hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 0 0-6.364 0l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                </div>
                <span className="text-base font-semibold text-slate-900 dark:text-white">Send Portal Link Only</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Email a link to the online quote portal only, without a PDF attachment.
              </p>
            </button>
          </div>

        </div>
      )}

      {step === 'compose' && (
        <div>
          {/* Back button */}
          <button
            type="button"
            onClick={() => setStep('method')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Change send method
          </button>

          {/* Method badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
              {sendMethod === 'pdf' && 'PDF + Portal Link'}
              {sendMethod === 'portal' && 'Portal Link Only'}
            </span>
          </div>

          {/* Zero sell price warning */}
          {hasZeroSellWarning && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30 p-3">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {zeroSellLines.length === 1 ? '1 line has' : `${zeroSellLines.length} lines have`} a zero sale price
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {zeroSellLines.map((desc, i) => (
                      <li key={i} className="text-xs text-amber-700 dark:text-amber-300">• {desc}</li>
                    ))}
                  </ul>
                  <label className="mt-2 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zeroSellConfirmed}
                      onChange={(e) => setZeroSellConfirmed(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      I confirm these lines should be sent at £0.00
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* From field */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From</label>
            {loadingCreds ? (
              <div className="text-sm text-slate-400">Loading...</div>
            ) : assignedCred && selectedSenderId === assignedCred.user_id ? (
              <div className="flex items-center gap-2">
                <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                  {assignedCred.display_name || assignedUser?.first_name + ' ' + assignedUser?.last_name} &lt;{assignedCred.email_address}&gt;
                  <span className="ml-2 text-xs text-slate-400">via Engage</span>
                </div>
              </div>
            ) : !assignedCred && orgCreds.length > 0 ? (
              <div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/30 p-2.5 mb-2">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name} hasn't connected their mailbox.` : 'No assigned user.'} Select a fallback sender:
                  </p>
                </div>
                <select
                  value={selectedSenderId}
                  onChange={e => setSelectedSenderId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  {orgCreds.map(c => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.display_name || c.email_address} &lt;{c.email_address}&gt;
                    </option>
                  ))}
                </select>
              </div>
            ) : orgCreds.length === 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 p-2.5">
                <p className="text-xs text-red-700 dark:text-red-300">
                  No mailboxes connected. An admin must connect at least one mailbox in Settings → Team before quotes can be sent.
                </p>
              </div>
            ) : (
              <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                {selectedCred?.display_name} &lt;{selectedCred?.email_address}&gt;
                <span className="ml-2 text-xs text-slate-400">via Engage</span>
              </div>
            )}
          </div>

          {/* To field */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">To</label>
              {!showCcBcc && (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  CC / BCC
                </button>
              )}
            </div>
            <input
              type="text"
              value={toField}
              onChange={e => setToField(e.target.value)}
              placeholder="name@example.com (separate multiple with commas)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {/* CC / BCC fields */}
          {showCcBcc && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CC</label>
                <input
                  type="text"
                  value={ccField}
                  onChange={e => setCcField(e.target.value)}
                  placeholder="name@example.com (separate multiple with commas)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">BCC</label>
                <input
                  type="text"
                  value={bccField}
                  onChange={e => setBccField(e.target.value)}
                  placeholder="name@example.com (separate multiple with commas)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {/* Message */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
            <textarea
              value={messageBody}
              onChange={e => setMessageBody(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400 resize-y"
              style={{ minHeight: '120px' }}
            />
          </div>

          {/* Preview section */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${showPreview ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              Attachments & Links
            </button>
            {showPreview && (
              <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                {sendMethod === 'pdf' && (
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                    <span className="font-mono text-xs">{quote.quote_number}.pdf</span>
                  </div>
                )}
                {portalUrl && (
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 0 0-6.364 0l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                    </svg>
                    <span className="text-xs text-slate-400 break-all">{portalUrl}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button size="sm" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="blue"
              onClick={handleSend}
              disabled={sending || !canSend}
            >
              {sending ? 'Sending...' : isResend ? 'Resend Quote' : 'Send Quote'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function parseEmailAddresses(input: string): string[] {
  // Parse "Name <email>" format or plain email addresses, comma-separated
  const parts = input.split(',').map(p => p.trim()).filter(Boolean)
  const emails: string[] = []

  for (const part of parts) {
    // Match "Name <email@example.com>" pattern
    const angleMatch = part.match(/<([^>]+)>/)
    if (angleMatch) {
      emails.push(angleMatch[1].trim())
    } else if (part.includes('@')) {
      emails.push(part.trim())
    }
  }

  return emails
}
