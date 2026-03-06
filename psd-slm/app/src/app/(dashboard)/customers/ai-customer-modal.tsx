'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/form-fields'
import { Badge } from '@/components/ui/badge'
import { createCustomer } from './actions'

const CONFIDENCE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High Confidence', color: '#059669', bg: '#ecfdf5' },
  medium: { label: 'Medium Confidence', color: '#d97706', bg: '#fffbeb' },
  low: { label: 'Low Confidence', color: '#dc2626', bg: '#fef2f2' },
}

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'charity', label: 'Charity' },
]

type ModalState = 'screenshot' | 'paste' | 'loading' | 'review' | 'saving' | 'error'

interface AiCustomerModalProps {
  initialMode: 'screenshot' | 'paste'
  onClose: () => void
}

export function AiCustomerModal({ initialMode, onClose }: AiCustomerModalProps) {
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [state, setState] = useState<ModalState>(initialMode)
  const [pastedText, setPastedText] = useState('')
  const [error, setError] = useState('')

  // Screenshot state
  const [imageBase64, setImageBase64] = useState('')
  const [imageMimeType, setImageMimeType] = useState('')
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState('')
  const [imageFileSize, setImageFileSize] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  // Review form state
  const [form, setForm] = useState({
    name: '',
    customer_type: 'business',
    address_line1: '',
    address_line2: '',
    city: '',
    county: '',
    postcode: '',
    phone: '',
    email: '',
    website: '',
    vat_number: '',
    payment_terms: '30',
    notes: '',
    contact_first_name: '',
    contact_last_name: '',
    contact_job_title: '',
    contact_email: '',
    contact_phone: '',
    contact_mobile: '',
  })
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleScreenshotFile = useCallback((file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Please use a PNG, JPEG, WebP, or GIF image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }
    setError('')
    setImageFileName(file.name)
    setImageFileSize(file.size)

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setImagePreviewUrl(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setImageBase64(base64)
      setImageMimeType(file.type)
    }
    reader.readAsDataURL(file)
  }, [])

  const clearImage = () => {
    setImageBase64('')
    setImageMimeType('')
    setImagePreviewUrl(null)
    setImageFileName('')
    setImageFileSize(0)
  }

  const populateFromResult = (data: Record<string, unknown>) => {
    const ext = data.extracted as Record<string, unknown>
    setForm((f) => ({
      ...f,
      name: (ext.company_name as string) || '',
      customer_type: (ext.customer_type as string) || 'business',
      address_line1: (ext.address_line1 as string) || '',
      address_line2: (ext.address_line2 as string) || '',
      city: (ext.city as string) || '',
      county: (ext.county as string) || '',
      postcode: (ext.postcode as string) || '',
      phone: (ext.phone as string) || '',
      email: (ext.email as string) || '',
      website: (ext.website as string) || '',
      vat_number: (ext.vat_number as string) || '',
      contact_first_name: (ext.contact_first_name as string) || '',
      contact_last_name: (ext.contact_last_name as string) || '',
      contact_job_title: (ext.contact_job_title as string) || '',
      contact_email: (ext.contact_email as string) || '',
      contact_phone: (ext.contact_phone as string) || '',
      contact_mobile: (ext.contact_mobile as string) || '',
    }))
    setConfidence((ext.confidence as 'high' | 'medium' | 'low') || 'medium')
  }

  const handleAnalyseScreenshot = async () => {
    if (!imageBase64) return
    setState('loading')
    setError('')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/customers/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, image_type: imageMimeType }),
        signal: abortRef.current.signal,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to analyse screenshot')
        setState('screenshot')
        return
      }
      populateFromResult(data)
      setState('review')
    } catch (err) {
      if ((err as Error).name === 'AbortError') { setState('screenshot'); return }
      setError('Network error — could not reach the server')
      setState('screenshot')
    }
  }

  const handleAnalysePasted = async () => {
    if (!pastedText.trim() || pastedText.trim().length < 10) {
      setError('Please paste more content — at least a few lines of company information')
      return
    }
    setState('loading')
    setError('')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/customers/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pastedText }),
        signal: abortRef.current.signal,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to analyse content')
        setState('paste')
        return
      }
      populateFromResult(data)
      setState('review')
    } catch (err) {
      if ((err as Error).name === 'AbortError') { setState('paste'); return }
      setError('Network error — could not reach the server')
      setState('paste')
    }
  }

  // Paste event listener for screenshot mode
  useEffect(() => {
    if (state !== 'screenshot') return
    const handlePaste = (e: ClipboardEvent) => {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) handleScreenshotFile(file)
          return
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [state, handleScreenshotFile])

  const handleCancel = () => {
    abortRef.current?.abort()
    onClose()
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Company name is required'); return }
    if (!form.customer_type) { setError('Customer type is required'); return }

    setState('saving')
    setError('')

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))

    const result = await createCustomer(fd)

    if (result.error) {
      setError(result.error)
      setState('review')
    } else if (result.data?.id) {
      router.push(`/customers/${result.data.id}`)
    }
  }

  const modalTitle = (() => {
    switch (state) {
      case 'screenshot': return 'AI Add — Screenshot'
      case 'paste': return 'AI Add — Email / Text'
      case 'loading': return imageBase64 ? 'AI Add — Screenshot' : 'AI Add — Email / Text'
      case 'review':
      case 'saving': return 'Review Customer'
      case 'error': return 'AI Add Customer'
      default: return 'AI Add Customer'
    }
  })()

  // --- Screenshot state ---
  if (state === 'screenshot') {
    return (
      <Modal title={modalTitle} onClose={onClose} width={600}>
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 mb-4">
          <p className="text-xs text-purple-700">
            Paste a screenshot (Ctrl+V) or upload an image of a website, email signature, business card, or letterhead.
          </p>
        </div>

        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) handleScreenshotFile(file)
          }}
          onClick={() => !imagePreviewUrl && fileInputRef.current?.click()}
          className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragOver
              ? 'border-purple-400 bg-purple-50'
              : imagePreviewUrl
                ? 'border-slate-200 bg-white'
                : 'border-slate-300 bg-slate-50 cursor-pointer hover:border-slate-400 hover:bg-slate-100'
          }`}
        >
          {imagePreviewUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img src={imagePreviewUrl} alt="Screenshot preview" className="max-h-64 rounded object-contain" />
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{imageFileName}</span>
                <span>({(imageFileSize / 1024).toFixed(0)} KB)</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); clearImage() }} className="text-red-500 hover:text-red-700 font-medium">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4">
              <svg className="h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-500">Paste screenshot or drop image here</p>
              <p className="text-xs text-slate-400">Websites, email signatures, business cards, letterheads</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleScreenshotFile(file)
            e.target.value = ''
          }}
        />

        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => { setError(''); setState('paste') }} className="text-xs text-slate-400 hover:text-slate-600">
            Paste text instead
          </button>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="purple" onClick={handleAnalyseScreenshot} disabled={!imageBase64}>Analyse</Button>
        </div>
      </Modal>
    )
  }

  // --- Paste state ---
  if (state === 'paste') {
    return (
      <Modal title={modalTitle} onClose={onClose} width={600}>
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 mb-4">
          <p className="text-xs text-purple-700">
            Paste an email signature, company website text, or any content containing company details.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Content</label>
          <textarea
            value={pastedText}
            onChange={(e) => { setPastedText(e.target.value); setError('') }}
            placeholder="Paste company details here..."
            rows={6}
            className="w-full resize-vertical rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 font-[inherit]"
          />
          {pastedText.trim().length > 0 && (
            <p className="mt-1 text-xs text-slate-400">{pastedText.trim().length.toLocaleString()} characters</p>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => { setError(''); setState('screenshot') }} className="text-xs text-slate-400 hover:text-slate-600">
            Use screenshot instead
          </button>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="purple" onClick={handleAnalysePasted} disabled={!pastedText.trim()}>Analyse</Button>
        </div>
      </Modal>
    )
  }

  // --- Loading state ---
  if (state === 'loading') {
    return (
      <Modal title={modalTitle} onClose={onClose} width={500}>
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-purple-700" />
          <p className="text-sm text-slate-600">{imageBase64 ? 'Analysing screenshot...' : 'Analysing content...'}</p>
          <p className="text-xs text-slate-400">This may take a few seconds</p>
          <Button size="sm" onClick={handleCancel} className="mt-2">Cancel</Button>
        </div>
      </Modal>
    )
  }

  // --- Error state ---
  if (state === 'error') {
    return (
      <Modal title={modalTitle} onClose={onClose} width={500}>
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="purple" onClick={() => { setError(''); setState(initialMode) }}>Try Again</Button>
        </div>
      </Modal>
    )
  }

  // --- Review / Saving state ---
  const hasContact = form.contact_first_name || form.contact_last_name

  return (
    <Modal title={modalTitle} onClose={onClose} width={640}>
      <div className="flex items-center gap-2 mb-3">
        <Badge {...CONFIDENCE_BADGE[confidence]} />
      </div>

      <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 mb-4">
        <p className="text-xs text-purple-700">
          Fields auto-populated from {imageBase64 ? 'screenshot' : 'pasted content'}. Review and adjust before saving.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Customer Type *"
          options={CUSTOMER_TYPE_OPTIONS}
          placeholder="Select type..."
          value={form.customer_type}
          onChange={upd('customer_type')}
          disabled={state === 'saving'}
          className="col-span-2"
        />
        <Input label="Company Name *" value={form.name} onChange={upd('name')} disabled={state === 'saving'} className="col-span-2" />
        <Input label="Address Line 1" value={form.address_line1} onChange={upd('address_line1')} disabled={state === 'saving'} className="col-span-2" />
        <Input label="Address Line 2" value={form.address_line2} onChange={upd('address_line2')} disabled={state === 'saving'} className="col-span-2" />
        <Input label="City" value={form.city} onChange={upd('city')} disabled={state === 'saving'} />
        <Input label="County" value={form.county} onChange={upd('county')} disabled={state === 'saving'} />
        <Input label="Postcode" value={form.postcode} onChange={upd('postcode')} disabled={state === 'saving'} />
        <Input label="Phone" value={form.phone} onChange={upd('phone')} disabled={state === 'saving'} />
        <Input label="Email" value={form.email} onChange={upd('email')} disabled={state === 'saving'} />
        <Input label="Website" value={form.website} onChange={upd('website')} disabled={state === 'saving'} />
        <Input label="VAT Number" value={form.vat_number} onChange={upd('vat_number')} disabled={state === 'saving'} />
        <Input label="Payment Terms (days)" type="number" value={form.payment_terms} onChange={upd('payment_terms')} disabled={state === 'saving'} />
      </div>

      {/* Primary Contact section */}
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          Primary Contact
          {!hasContact && <span className="ml-2 text-xs font-normal text-slate-400">(optional — can add later)</span>}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="First Name" value={form.contact_first_name} onChange={upd('contact_first_name')} disabled={state === 'saving'} />
          <Input label="Last Name" value={form.contact_last_name} onChange={upd('contact_last_name')} disabled={state === 'saving'} />
          <Input label="Job Title" value={form.contact_job_title} onChange={upd('contact_job_title')} disabled={state === 'saving'} className="col-span-2" />
          <Input label="Email" value={form.contact_email} onChange={upd('contact_email')} disabled={state === 'saving'} />
          <Input label="Phone" value={form.contact_phone} onChange={upd('contact_phone')} disabled={state === 'saving'} />
          <Input label="Mobile" value={form.contact_mobile} onChange={upd('contact_mobile')} disabled={state === 'saving'} />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose} disabled={state === 'saving'}>Cancel</Button>
        <Button
          variant="purple"
          onClick={handleSave}
          disabled={!form.name.trim() || !form.customer_type || state === 'saving'}
        >
          {state === 'saving' ? 'Creating...' : 'Create Customer'}
        </Button>
      </div>
    </Modal>
  )
}
