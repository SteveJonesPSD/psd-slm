'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { sendPoEmail } from '../actions'
import { getUserMailCredential, getOrgMailCredentials } from '../../quotes/send-actions'
import type { UserMailCredential } from '@/lib/email/types'
import { useAuth } from '@/components/auth-provider'

interface SendPoModalProps {
  po: {
    id: string
    po_number: string
    supplier_name: string
    supplier_email: string | null
  }
  onClose: () => void
}

export function SendPoModal({ po, onClose }: SendPoModalProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // Sender state
  const [orgCreds, setOrgCreds] = useState<UserMailCredential[]>([])
  const [selectedSenderId, setSelectedSenderId] = useState<string>('')
  const [loadingCreds, setLoadingCreds] = useState(true)

  // Compose fields
  const [toField, setToField] = useState(po.supplier_email || '')
  const [ccField, setCcField] = useState('')
  const [bccField, setBccField] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [subject, setSubject] = useState(`Purchase Order ${po.po_number}`)
  const [messageBody, setMessageBody] = useState(
    `Please find attached our purchase order ${po.po_number}.

Please confirm receipt and expected delivery date at your earliest convenience.`
  )

  // Load credentials
  useEffect(() => {
    async function load() {
      try {
        const [userCredResult, orgCredsResult] = await Promise.all([
          user?.id ? getUserMailCredential(user.id) : Promise.resolve(null),
          getOrgMailCredentials(),
        ])
        setOrgCreds(orgCredsResult)

        if (userCredResult) {
          setSelectedSenderId(userCredResult.user_id)
        } else if (orgCredsResult.length > 0) {
          setSelectedSenderId(orgCredsResult[0].user_id)
        }
      } finally {
        setLoadingCreds(false)
      }
    }
    load()
  }, [user?.id])

  const selectedCred = orgCreds.find(c => c.user_id === selectedSenderId)
  const canSend = selectedSenderId && toField.trim() && subject.trim()

  const handleSend = async () => {
    if (!selectedSenderId) return
    setError('')
    setSending(true)

    const toAddresses = parseEmailAddresses(toField)
    if (toAddresses.length === 0) {
      setError('Please enter at least one valid email address')
      setSending(false)
      return
    }

    const ccAddresses = parseEmailAddresses(ccField)
    const bccAddresses = parseEmailAddresses(bccField)

    const result = await sendPoEmail(po.id, {
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

  return (
    <Modal title="Send PO to Supplier" onClose={onClose} width={700}>
      <div>
        {/* Method badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
            PDF Attachment
          </span>
        </div>

        {/* From field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From</label>
          {loadingCreds ? (
            <div className="text-sm text-slate-400">Loading...</div>
          ) : orgCreds.length === 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 p-2.5">
              <p className="text-xs text-red-700 dark:text-red-300">
                No mailboxes connected. An admin must connect at least one mailbox in Settings &rarr; Team before POs can be sent by email.
              </p>
            </div>
          ) : orgCreds.length === 1 ? (
            <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
              {selectedCred?.display_name || selectedCred?.email_address} &lt;{selectedCred?.email_address}&gt;
              <span className="ml-2 text-xs text-slate-400">via Engage</span>
            </div>
          ) : (
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
            placeholder="supplier@example.com (separate multiple with commas)"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          {!po.supplier_email && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              No email address on file for this supplier. Please enter one manually.
            </p>
          )}
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
            Attachments
          </button>
          {showPreview && (
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-600 dark:text-slate-300 space-y-2">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <span className="font-mono text-xs">{po.po_number}.pdf</span>
              </div>
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
            {sending ? 'Sending...' : 'Send to Supplier'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function parseEmailAddresses(input: string): string[] {
  const parts = input.split(',').map(p => p.trim()).filter(Boolean)
  const emails: string[] = []

  for (const part of parts) {
    const angleMatch = part.match(/<([^>]+)>/)
    if (angleMatch) {
      emails.push(angleMatch[1].trim())
    } else if (part.includes('@')) {
      emails.push(part.trim())
    }
  }

  return emails
}
