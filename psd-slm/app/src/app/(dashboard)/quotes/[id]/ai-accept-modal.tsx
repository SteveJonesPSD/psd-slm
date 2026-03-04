'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { manuallyAcceptQuote } from '../actions'

interface AiAcceptModalProps {
  quoteId: string
  quoteNumber: string
  onClose: () => void
}

interface Verification {
  po_number: string | null
  customer_name_match: boolean | null
  extracted_customer: string | null
  quote_customer: string
  total_match: boolean | null
  total_match_type: 'ex_vat' | 'inc_vat' | null
  extracted_total: number | null
  quote_total_ex_vat: number
  quote_total_inc_vat: number
  total_difference: number | null
  line_count_match: boolean | null
  extracted_line_count: number
  quote_line_count: number
  extracted_lines: { description: string; quantity: number; unit_price: number; line_total: number }[]
  extraction_method: string
}

type InputTab = 'pdf' | 'email' | 'screenshot'
type Step = 'input' | 'verify'

export function AiAcceptModal({ quoteId, quoteNumber, onClose }: AiAcceptModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [activeTab, setActiveTab] = useState<InputTab>('pdf')
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [extractedPoNumber, setExtractedPoNumber] = useState('')
  const [accepting, setAccepting] = useState(false)

  // Input refs
  const [emailText, setEmailText] = useState('')
  const [pastedImage, setPastedImage] = useState<{ base64: string; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileUpload = async (file: File) => {
    if (!(file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      setError('Please select a PDF file')
      return
    }
    if (analysing) return
    setSelectedFile(file)
    setError(null)
    setAnalysing(true)

    try {
      const formData = new FormData()
      formData.append('quote_id', quoteId)
      formData.append('input_type', 'pdf')
      formData.append('file', file)

      const res = await fetch('/api/quotes/accept-po', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Extraction failed')
        setSelectedFile(null)
        return
      }

      setVerification(data.verification)
      setExtractedPoNumber(data.extracted?.po_number || '')
      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
      setSelectedFile(null)
    } finally {
      setAnalysing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1]
          setPastedImage({ base64, type: item.type })
          setError(null)
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }

  const handleAnalyse = async () => {
    setError(null)
    setAnalysing(true)

    try {
      const formData = new FormData()
      formData.append('quote_id', quoteId)

      if (activeTab === 'pdf') {
        if (!selectedFile) {
          setError('Please select a PDF file')
          setAnalysing(false)
          return
        }
        formData.append('input_type', 'pdf')
        formData.append('file', selectedFile)
      } else if (activeTab === 'email') {
        if (!emailText.trim() || emailText.trim().length < 50) {
          setError('Please paste at least 50 characters of email text')
          setAnalysing(false)
          return
        }
        formData.append('input_type', 'email_text')
        formData.append('email_text', emailText)
      } else if (activeTab === 'screenshot') {
        if (!pastedImage) {
          setError('Please paste or drop a screenshot')
          setAnalysing(false)
          return
        }
        formData.append('input_type', 'screenshot')
        formData.append('screenshot', pastedImage.base64)
        formData.append('screenshot_type', pastedImage.type)
      }

      const res = await fetch('/api/quotes/accept-po', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Extraction failed')
        setAnalysing(false)
        return
      }

      setVerification(data.verification)
      setExtractedPoNumber(data.extracted?.po_number || '')
      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setAnalysing(false)
    }
  }

  const handleAccept = async () => {
    setAccepting(true)
    const result = await manuallyAcceptQuote(quoteId, extractedPoNumber.trim() || undefined, 'internal_ai_accept')
    setAccepting(false)
    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      onClose()
      router.refresh()
    }
  }

  const CheckIcon = () => (
    <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )

  const CrossIcon = () => (
    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )

  const DashIcon = () => (
    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
  )

  const tabs: { key: InputTab; label: string }[] = [
    { key: 'pdf', label: 'PDF' },
    { key: 'email', label: 'Email Text' },
    { key: 'screenshot', label: 'Screenshot' },
  ]

  if (step === 'verify' && verification) {
    const allChecksPass = verification.customer_name_match !== false &&
      verification.total_match !== false &&
      verification.po_number

    return (
      <Modal title="AI Accept — Verification" onClose={onClose} width={800}>
        <div className="space-y-4">
          {/* PO Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              PO Number
            </label>
            <input
              type="text"
              value={extractedPoNumber}
              onChange={(e) => setExtractedPoNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="Enter PO number if not extracted"
            />
            {!extractedPoNumber.trim() && (
              <p className="text-xs text-amber-600 mt-1">PO number not detected — please enter manually</p>
            )}
          </div>

          {/* Verification table */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Check</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">PO Document</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quote {quoteNumber}</th>
                  <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Match</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium">Customer Name</td>
                  <td className="px-4 py-2.5">{verification.extracted_customer || '\u2014'}</td>
                  <td className="px-4 py-2.5">{verification.quote_customer}</td>
                  <td className="px-4 py-2.5 text-center">
                    {verification.customer_name_match === true ? <CheckIcon /> :
                     verification.customer_name_match === false ? <CrossIcon /> : <DashIcon />}
                  </td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium">Total Value</td>
                  <td className="px-4 py-2.5">
                    {verification.extracted_total !== null ? formatCurrency(verification.extracted_total) : '\u2014'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div>{formatCurrency(verification.quote_total_ex_vat)} <span className="text-[10px] text-slate-400">ex VAT</span></div>
                    <div>{formatCurrency(verification.quote_total_inc_vat)} <span className="text-[10px] text-slate-400">inc VAT</span></div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {verification.total_match === true ? <CheckIcon /> :
                       verification.total_match === false ? <CrossIcon /> : <DashIcon />}
                      {verification.total_match_type && (
                        <span className="text-[10px] text-emerald-600">{verification.total_match_type === 'ex_vat' ? 'ex VAT' : 'inc VAT'}</span>
                      )}
                    </div>
                  </td>
                </tr>
                {verification.total_match === false && verification.total_difference !== null && (
                  <tr className="border-t border-slate-100 bg-red-50/50">
                    <td className="px-4 py-2 text-xs text-red-600" colSpan={4}>
                      Difference: {formatCurrency(Math.abs(verification.total_difference))}
                      {verification.total_difference > 0 ? ' (PO higher)' : ' (PO lower)'}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium">Line Count</td>
                  <td className="px-4 py-2.5">{verification.extracted_line_count || '\u2014'}</td>
                  <td className="px-4 py-2.5">{verification.quote_line_count}</td>
                  <td className="px-4 py-2.5 text-center">
                    {verification.line_count_match === true ? <CheckIcon /> :
                     verification.line_count_match === false ? <CrossIcon /> : <DashIcon />}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Extracted lines */}
          {verification.extracted_lines.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Extracted PO Lines</h4>
              <div className="rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase text-slate-500">Description</th>
                      <th className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase text-slate-500">Qty</th>
                      <th className="px-3 py-1.5 text-right text-[11px] font-semibold uppercase text-slate-500">Unit Price</th>
                      <th className="px-3 py-1.5 text-right text-[11px] font-semibold uppercase text-slate-500">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verification.extracted_lines.map((line, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-xs">{line.description}</td>
                        <td className="px-3 py-1.5 text-center text-xs">{line.quantity}</td>
                        <td className="px-3 py-1.5 text-right text-xs">{formatCurrency(line.unit_price)}</td>
                        <td className="px-3 py-1.5 text-right text-xs">{formatCurrency(line.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Warnings */}
          {!allChecksPass && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Some verification checks failed or could not be completed. Review the results carefully before accepting.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setStep('input'); setVerification(null); setError(null) }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              &larr; Re-analyse
            </button>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="success"
                onClick={handleAccept}
                disabled={accepting || !extractedPoNumber.trim()}
              >
                {accepting ? 'Accepting...' : 'Accept Quote'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="AI Accept — Upload Customer PO" onClose={onClose}>
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(null) }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* PDF Tab */}
        {activeTab === 'pdf' && (
          <div
            onDragOver={(e) => { e.preventDefault(); if (!analysing) setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => { if (!analysing) fileInputRef.current?.click() }}
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              analysing ? 'border-purple-300 bg-purple-50 cursor-wait' :
              dragOver ? 'border-purple-400 bg-purple-50 cursor-pointer' :
              'border-slate-200 hover:border-slate-300 cursor-pointer'
            }`}
          >
            {analysing ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="animate-spin h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-medium text-purple-600">Analysing customer PO...</p>
                {selectedFile && <p className="text-xs text-purple-400">{selectedFile.name}</p>}
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-500">Drop a PDF here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Customer PO document (max 10MB)</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div>
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              rows={8}
              placeholder="Paste the customer's PO email content here..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <p className="text-xs text-slate-400 mt-1">{emailText.length} characters</p>
          </div>
        )}

        {/* Screenshot Tab */}
        {activeTab === 'screenshot' && (
          <div
            onPaste={handlePaste}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files[0]
              if (file && file.type.startsWith('image/')) {
                const reader = new FileReader()
                reader.onload = () => {
                  const result = reader.result as string
                  const base64 = result.split(',')[1]
                  setPastedImage({ base64, type: file.type })
                }
                reader.readAsDataURL(file)
              }
            }}
            tabIndex={0}
            className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors outline-none ${
              dragOver ? 'border-purple-400 bg-purple-50' : pastedImage ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {pastedImage ? (
              <div>
                <img
                  src={`data:${pastedImage.type};base64,${pastedImage.base64}`}
                  alt="Pasted screenshot"
                  className="max-h-32 mx-auto rounded"
                />
                <p className="text-xs text-emerald-500 mt-2">Screenshot ready</p>
                <button onClick={(e) => { e.stopPropagation(); setPastedImage(null) }} className="text-xs text-slate-400 hover:text-slate-600 mt-1">
                  Clear
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-500">Click here then Ctrl+V to paste a screenshot</p>
                <p className="text-xs text-slate-400 mt-1">Or drag and drop an image</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="default" onClick={onClose}>
            Cancel
          </Button>
          {activeTab !== 'pdf' && (
            <Button
              size="sm"
              variant="purple"
              onClick={handleAnalyse}
              disabled={analysing}
            >
              {analysing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analysing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                  Analyse PO
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
