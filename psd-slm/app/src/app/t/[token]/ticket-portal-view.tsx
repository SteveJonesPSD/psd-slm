'use client'

import { useState, useRef, useEffect } from 'react'
import { Badge, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from '@/components/ui/badge'

interface TicketData {
  id: string
  orgId: string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  ticketType: string
  createdAt: string
  customerName: string | null
  contactName: string | null
}

interface MessageData {
  id: string
  body: string
  senderType: string
  senderName: string | null
  createdAt: string
}

interface AttachmentData {
  id: string
  messageId: string | null
  fileName: string
  fileSize: number | null
  mimeType: string | null
}

interface TicketPortalViewProps {
  ticket: TicketData
  messages: MessageData[]
  attachments: AttachmentData[]
  token: string
}

function isImageMimeType(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith('image/')
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TicketPortalView({ ticket, messages, attachments, token }: TicketPortalViewProps) {
  const [senderName, setSenderName] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load sender name from localStorage or pre-populate from contact
  useEffect(() => {
    const stored = localStorage.getItem(`ticket-portal-name-${ticket.id}`)
    if (stored) {
      setSenderName(stored)
    } else if (ticket.contactName) {
      setSenderName(ticket.contactName)
    }
  }, [ticket.id, ticket.contactName])

  // Scroll to bottom on load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persist sender name
  function handleNameChange(name: string) {
    setSenderName(name)
    localStorage.setItem(`ticket-portal-name-${ticket.id}`, name)
  }

  // Get attachments for a specific message
  function getMessageAttachments(messageId: string) {
    return attachments.filter(a => a.messageId === messageId)
  }

  function attachmentUrl(attachmentId: string) {
    return `/api/tickets/${ticket.id}/portal/attachments/${attachmentId}?token=${token}`
  }

  // Handle file selection
  function handleFilesSelected(newFiles: FileList | null) {
    if (!newFiles) return
    setFiles(prev => [...prev, ...Array.from(newFiles)])
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!messageBody.trim() || !senderName.trim()) return

    setSending(true)
    setError(null)

    const formData = new FormData()
    formData.set('token', token)
    formData.set('message', messageBody.trim())
    formData.set('sender_name', senderName.trim())
    for (const file of files) {
      formData.append('files', file)
    }

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/portal/reply`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to send reply')
        setSending(false)
        return
      }

      // Full page reload to show the new message
      window.location.reload()
    } catch {
      setError('Failed to send reply. Please try again.')
      setSending(false)
    }
  }

  const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
  const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority]

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-mono text-slate-400">{ticket.ticketNumber}</span>
          {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
          {priorityCfg && <Badge label={priorityCfg.label} color={priorityCfg.color} bg={priorityCfg.bg} />}
        </div>
        <h1 className="text-lg font-bold text-slate-900">{ticket.subject}</h1>
        {ticket.customerName && (
          <p className="text-sm text-slate-500 mt-1">{ticket.customerName}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          Opened {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Conversation Thread */}
      <div className="space-y-3 mb-4">
        {messages.map(msg => {
          const msgAttachments = getMessageAttachments(msg.id)

          if (msg.senderType === 'system') {
            return (
              <div key={msg.id} className="text-center py-1">
                <span className="text-xs text-slate-400 italic">{msg.body}</span>
              </div>
            )
          }

          const isCustomer = msg.senderType === 'customer'
          return (
            <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-3 sm:p-4 ${isCustomer ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200'}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className={`text-xs font-semibold ${isCustomer ? 'text-indigo-100' : 'text-slate-700'}`}>
                    {msg.senderName || (isCustomer ? 'You' : 'Support')}
                  </span>
                  <span className={`text-[10px] shrink-0 ${isCustomer ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {new Date(msg.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`text-sm whitespace-pre-wrap ${isCustomer ? 'text-white' : 'text-slate-700'}`}>
                  {msg.body}
                </div>

                {/* Attachments */}
                {msgAttachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msgAttachments.map(att => (
                      <a
                        key={att.id}
                        href={attachmentUrl(att.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs no-underline ${
                          isCustomer
                            ? 'bg-indigo-500 text-indigo-100 hover:bg-indigo-400'
                            : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                        }`}
                      >
                        {isImageMimeType(att.mimeType) ? (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                          </svg>
                        )}
                        <span className="truncate max-w-[120px]">{att.fileName}</span>
                        {att.fileSize ? (
                          <span className={`${isCustomer ? 'text-indigo-200' : 'text-slate-400'}`}>
                            ({formatFileSize(att.fileSize)})
                          </span>
                        ) : null}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Form — sticky on mobile */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 rounded-xl p-4 sm:p-5 shadow-lg">
        <form onSubmit={handleSubmit}>
          {/* Sender Name */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Your Name</label>
            <input
              type="text"
              value={senderName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Message */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Message</label>
            <textarea
              value={messageBody}
              onChange={e => setMessageBody(e.target.value)}
              rows={3}
              placeholder="Type your reply..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* File Preview Strip */}
          {files.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="relative flex items-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1 text-xs text-slate-600"
                >
                  {file.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                  )}
                  <span className="truncate max-w-[100px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="ml-1 text-slate-400 hover:text-red-500"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Take Photo (camera capture on mobile) */}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
              Take Photo
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => handleFilesSelected(e.target.files)}
              className="hidden"
            />

            {/* Attach File */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
              </svg>
              Attach File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx"
              multiple
              onChange={e => handleFilesSelected(e.target.files)}
              className="hidden"
            />

            <div className="flex-1" />

            {/* Submit */}
            <button
              type="submit"
              disabled={sending || !messageBody.trim() || !senderName.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
