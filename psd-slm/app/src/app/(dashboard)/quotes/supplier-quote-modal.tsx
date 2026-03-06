'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/form-fields'
import { formatCurrency } from '@/lib/utils'
import { createQuoteFromSupplierImport } from './actions'
import { createProduct } from '../products/actions'
import type { ExtractedSupplierQuote, ProductMatchResult, SupplierMatchResult } from '@/lib/supplier-quote/types'

interface Lookups {
  customers: { id: string; name: string; customer_type: string | null }[]
  contacts: { id: string; customer_id: string; first_name: string; last_name: string }[]
  suppliers: { id: string; name: string }[]
  users: { id: string; first_name: string; last_name: string }[]
  brands: { id: string; name: string; customer_type: string | null }[]
}

interface LineState {
  description: string
  product_code: string | null
  manufacturer_part: string | null
  quantity: number
  buy_price: number
  sell_price: number
  product_id: string | null
  product_name: string | null
  match_confidence: 'exact' | 'high' | 'low' | 'none'
  suggested_products: { id: string; name: string; sku: string | null; default_sell_price: number; score: number }[]
  ignored: boolean
  creating_product: boolean
}

export interface MergeLinesData {
  groupName: string
  supplierId: string | null
  newSupplierName: string | null
  lines: Array<{
    product_id: string | null
    description: string
    quantity: number
    buy_price: number
    sell_price: number
    supplier_id: string | null
  }>
  pdfStoragePath: string | null
  pdfFileName: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  mode?: 'create' | 'merge'
  existingQuoteId?: string
  onMergeLines?: (data: MergeLinesData) => void
}

// SearchableSelect is now imported from @/components/ui/form-fields

// --- Main modal ---

export function SupplierQuoteModal({ open, onClose, mode = 'create', existingQuoteId, onMergeLines }: Props) {
  const router = useRouter()
  const isMerge = mode === 'merge'
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step state
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  // Input mode
  const [inputMode, setInputMode] = useState<'pdf' | 'email' | 'screenshot'>('pdf')
  const [emailText, setEmailText] = useState('')
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null)
  const [inputType, setInputType] = useState<string>('pdf')

  // Extracted data
  const [extracted, setExtracted] = useState<ExtractedSupplierQuote | null>(null)
  const [supplierMatch, setSupplierMatch] = useState<SupplierMatchResult | null>(null)
  const [lines, setLines] = useState<LineState[]>([])
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [pdfStoragePath, setPdfStoragePath] = useState<string | null>(null)
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)

  // Form state
  const [customerId, setCustomerId] = useState('')
  const [contactId, setContactId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [brandId, setBrandId] = useState('')
  const [quoteType, setQuoteType] = useState('')
  const [quoteTitle, setQuoteTitle] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [newSupplierName, setNewSupplierName] = useState<string | null>(null)

  // Quick product create
  const [quickCreate, setQuickCreate] = useState<{ lineIndex: number; sku: string; name: string; categoryId: string } | null>(null)

  // Reset all state when modal opens
  useEffect(() => {
    if (open) {
      setStep('upload')
      setUploading(false)
      setError('')
      setCreating(false)
      setInputMode('pdf')
      setEmailText('')
      setImageData(null)
      setInputType('pdf')
      setExtracted(null)
      setSupplierMatch(null)
      setLines([])
      setLookups(null)
      setPdfStoragePath(null)
      setPdfFileName(null)
      setCustomerId('')
      setContactId('')
      setAssignedTo('')
      setBrandId('')
      setQuoteType('')
      setSupplierId('')
      setNewSupplierName(null)
      setQuickCreate(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [open])

  // --- Shared result handler ---
  const processApiResult = useCallback((result: Record<string, unknown>) => {
    const ext = result.extracted as ExtractedSupplierQuote
    const matches = result.product_matches as ProductMatchResult[]

    setExtracted(ext)
    setSupplierMatch(result.supplier_match as SupplierMatchResult | null)
    setLookups(result.lookups as Lookups)
    setPdfStoragePath((result.pdf_storage_path as string) || null)
    setPdfFileName((result.pdf_file_name as string) || null)
    setAssignedTo((result.current_user_id as string) || '')
    setInputType((result.input_type as string) || 'pdf')

    if ((result.supplier_match as SupplierMatchResult)?.matched_supplier_id) {
      setSupplierId((result.supplier_match as SupplierMatchResult).matched_supplier_id!)
      setNewSupplierName(null)
    } else if (ext.supplier_name) {
      setSupplierId('')
      setNewSupplierName(ext.supplier_name)
    }

    const lineStates: LineState[] = ext.line_items.map((item, i) => {
      const match = matches[i]
      return {
        description: item.description || `Line ${item.line_number}`,
        product_code: item.product_code,
        manufacturer_part: item.manufacturer_part,
        quantity: item.quantity || 1,
        buy_price: item.unit_price || 0,
        sell_price: match?.default_sell_price || 0,
        product_id: match?.matched_product_id || null,
        product_name: match?.matched_product_name || null,
        match_confidence: match?.match_confidence || 'none',
        suggested_products: match?.suggested_products || [],
        ignored: false,
        creating_product: false,
      }
    })

    setLines(lineStates)
    setStep('review')
  }, [])

  // --- PDF/EML file handler ---
  const handleFileUpload = useCallback(async (file: File) => {
    const isEml = file.name.toLowerCase().endsWith('.eml')
    const isPdf = file.type === 'application/pdf'

    if (!isPdf && !isEml) {
      setError(inputMode === 'pdf' ? 'Only PDF files are accepted.' : 'Only .eml files are accepted.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const fd = new FormData()
      fd.set('file', file)

      const resp = await fetch('/api/quotes/analyse-supplier', {
        method: 'POST',
        body: fd,
      })

      const result = await resp.json()

      if (!resp.ok) {
        setError(result.error || 'Analysis failed')
        setUploading(false)
        return
      }

      processApiResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [inputMode, processApiResult])

  // --- Email text handler ---
  const handleEmailTextSubmit = useCallback(async () => {
    if (emailText.trim().length < 50) {
      setError('Email text too short. Please paste the full email content (minimum 50 characters).')
      return
    }

    setUploading(true)
    setError('')

    try {
      const fd = new FormData()
      fd.set('email_text', emailText)

      const resp = await fetch('/api/quotes/analyse-supplier', {
        method: 'POST',
        body: fd,
      })

      const result = await resp.json()

      if (!resp.ok) {
        setError(result.error || 'Analysis failed')
        setUploading(false)
        return
      }

      processApiResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setUploading(false)
    }
  }, [emailText, processApiResult])

  // --- Screenshot handler ---
  const handleScreenshotFile = useCallback((file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Please use a PNG, JPEG, WebP, or GIF image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.')
      return
    }
    setError('')

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      setImageData({ base64, mimeType: file.type, previewUrl: dataUrl })
    }
    reader.readAsDataURL(file)
  }, [])

  const handleScreenshotSubmit = useCallback(async () => {
    if (!imageData) return

    setUploading(true)
    setError('')

    try {
      const fd = new FormData()
      fd.set('screenshot', imageData.base64)
      fd.set('screenshot_type', imageData.mimeType)

      const resp = await fetch('/api/quotes/analyse-supplier', {
        method: 'POST',
        body: fd,
      })

      const result = await resp.json()

      if (!resp.ok) {
        setError(result.error || 'Analysis failed')
        setUploading(false)
        return
      }

      processApiResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setUploading(false)
    }
  }, [imageData, processApiResult])

  // Clipboard paste listener for screenshot mode
  useEffect(() => {
    if (!open || step !== 'upload' || inputMode !== 'screenshot') return

    const handlePaste = (e: ClipboardEvent) => {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) {
        return
      }

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
  }, [open, step, inputMode, handleScreenshotFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (inputMode === 'screenshot') {
      if (file.type.startsWith('image/')) handleScreenshotFile(file)
      else setError('Please drop an image file.')
    } else {
      handleFileUpload(file)
    }
  }

  const updateLine = (index: number, updates: Partial<LineState>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...updates } : l)))
  }

  const selectProduct = (lineIndex: number, product: { id: string; name: string; sku: string | null; default_sell_price: number }) => {
    updateLine(lineIndex, {
      product_id: product.id,
      product_name: product.name,
      match_confidence: 'exact',
      sell_price: lines[lineIndex].sell_price || product.default_sell_price,
      suggested_products: [],
    })
  }

  const clearProductMatch = (lineIndex: number) => {
    updateLine(lineIndex, {
      product_id: null,
      product_name: null,
      match_confidence: 'none',
    })
  }

  const handleQuickCreate = async (lineIndex: number) => {
    if (!quickCreate) return

    const fd = new FormData()
    fd.set('sku', quickCreate.sku)
    fd.set('name', quickCreate.name)
    fd.set('default_buy_price', String(lines[lineIndex].buy_price))
    fd.set('default_sell_price', String(lines[lineIndex].sell_price))
    fd.set('product_type', 'goods')
    fd.set('is_serialised', 'null')

    if (quickCreate.categoryId) {
      fd.set('category_id', quickCreate.categoryId)
    }

    if (supplierId) {
      fd.set('main_supplier_id', supplierId)
      if (lines[lineIndex].product_code) {
        fd.set('supplier_sku', lines[lineIndex].product_code!)
      }
      fd.set('supplier_standard_cost', String(lines[lineIndex].buy_price))
    }

    updateLine(lineIndex, { creating_product: true })
    const result = await createProduct(fd)
    updateLine(lineIndex, { creating_product: false })

    if ('error' in result && result.error) {
      setError(result.error)
    } else if ('data' in result && result.data) {
      selectProduct(lineIndex, {
        id: result.data.id,
        name: result.data.name,
        sku: result.data.sku,
        default_sell_price: result.data.default_sell_price || 0,
      })
      setQuickCreate(null)
    }
  }

  const handleSupplierChange = (id: string) => {
    setSupplierId(id)
    if (id) setNewSupplierName(null)
  }

  const handleSubmit = async () => {
    if (!isMerge && !customerId) {
      setError('Please select a customer.')
      return
    }

    if (!supplierId && !newSupplierName) {
      setError('Please select or create a supplier.')
      return
    }

    const activeLines = lines.filter((l) => !l.ignored)
    if (activeLines.length === 0) {
      setError('At least one line item must be included.')
      return
    }

    setCreating(true)
    setError('')

    const supplierName = newSupplierName || lookups?.suppliers.find((s) => s.id === supplierId)?.name
    const groupName = ''
    const resolvedSupplierId = supplierId || null

    if (isMerge && onMergeLines) {
      // Merge mode — return lines to the builder via callback
      onMergeLines({
        groupName,
        supplierId: resolvedSupplierId,
        newSupplierName: !supplierId ? newSupplierName : null,
        lines: activeLines.map((l) => ({
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          buy_price: l.buy_price,
          sell_price: l.sell_price,
          supplier_id: resolvedSupplierId,
        })),
        pdfStoragePath: pdfStoragePath,
        pdfFileName: pdfFileName,
      })
      setCreating(false)
      onClose()
      return
    }

    // Create mode — call server action
    const attachmentLabel = inputType === 'eml' || inputType === 'email_text' || inputType === 'screenshot'
      ? 'Supplier Email' : undefined

    const result = await createQuoteFromSupplierImport({
      customer_id: customerId,
      contact_id: contactId || null,
      assigned_to: assignedTo || null,
      brand_id: brandId || null,
      quote_type: quoteType || null,
      title: quoteTitle.trim() || null,
      supplier_id: resolvedSupplierId,
      new_supplier_name: !supplierId ? newSupplierName : null,
      group_name: groupName,
      lines: activeLines.map((l) => ({
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        buy_price: l.buy_price,
        sell_price: l.sell_price,
        supplier_id: resolvedSupplierId,
        product_code: l.product_code,
        manufacturer_part: l.manufacturer_part,
      })),
      pdf_storage_path: pdfStoragePath,
      pdf_file_name: pdfFileName,
      attachment_label: attachmentLabel,
    })

    setCreating(false)

    if ('error' in result && result.error) {
      setError(result.error)
    } else if ('data' in result && result.data) {
      onClose()
      router.push(`/quotes/${result.data.id}`)
    }
  }

  const filteredContacts = lookups?.contacts.filter((c) => c.customer_id === customerId) || []
  const selectedCustomerType = lookups?.customers.find((c) => c.id === customerId)?.customer_type || null
  const filteredBrands = selectedCustomerType
    ? (lookups?.brands || []).filter((b) => !b.customer_type || b.customer_type === selectedCustomerType)
    : (lookups?.brands || [])
  const activeLines = lines.filter((l) => !l.ignored)
  const totalBuy = activeLines.reduce((sum, l) => sum + l.quantity * l.buy_price, 0)
  const matchedCount = activeLines.filter((l) => l.product_id).length
  const unmatchedCount = activeLines.filter((l) => !l.product_id).length

  const supplierOptions = useMemo(() =>
    (lookups?.suppliers || []).map((s) => ({ value: s.id, label: s.name })),
    [lookups?.suppliers]
  )

  const customerOptions = useMemo(() =>
    (lookups?.customers || []).map((c) => ({ value: c.id, label: c.name })),
    [lookups?.customers]
  )

  // Build the "create new supplier" option for the dropdown
  const supplierCreateOption = useMemo(() => {
    if (!extracted?.supplier_name) return null
    // Only show if no supplier selected and name is from extraction
    const name = newSupplierName || extracted.supplier_name
    return {
      label: `+ Create "${name}"`,
      onSelect: () => {
        setSupplierId('')
        setNewSupplierName(name)
      },
    }
  }, [extracted?.supplier_name, newSupplierName])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl w-full mx-4 ${step === 'review' ? 'max-w-5xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {step === 'upload'
              ? (isMerge ? 'Import Supplier Lines' : (
                inputMode === 'pdf' ? 'AI Quote from Supplier PDF' :
                inputMode === 'email' ? 'AI Quote from Email' :
                'AI Quote from Screenshot'
              ))
              : (isMerge ? 'Review Lines to Add' : 'Review Supplier Quote')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="p-6">
            {/* Tab bar */}
            <div className="flex gap-1 mb-4 border-b border-slate-200">
              {([
                { key: 'pdf', label: 'PDF' },
                { key: 'email', label: 'Email' },
                { key: 'screenshot', label: 'Screenshot' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setInputMode(tab.key); setError('') }}
                  disabled={uploading}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    inputMode === tab.key
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  } disabled:opacity-50`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* PDF mode */}
            {inputMode === 'pdf' && (
              <>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropEvent}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                    uploading ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {uploading ? (
                    <div>
                      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <p className="text-sm font-medium text-blue-700">Analysing supplier quote...</p>
                      <p className="text-xs text-blue-500 mt-1">Extracting text and matching products</p>
                    </div>
                  ) : (
                    <div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      <p className="text-sm font-medium text-slate-700">Drop a supplier quote PDF here</p>
                      <p className="text-xs text-slate-400 mt-1">or click to browse (PDF, max 10MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            )}

            {/* Email mode */}
            {inputMode === 'email' && (
              <div className="space-y-4">
                {/* .eml file drop zone */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropEvent}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    uploading ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {uploading ? (
                    <div>
                      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <p className="text-sm font-medium text-blue-700">Analysing email...</p>
                      <p className="text-xs text-blue-500 mt-1">Extracting pricing and matching products</p>
                    </div>
                  ) : (
                    <div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      <p className="text-sm font-medium text-slate-700">Drop a .eml email file here</p>
                      <p className="text-xs text-slate-400 mt-1">or click to browse (save email as .eml from Outlook)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".eml"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!uploading && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-3 text-xs text-slate-400 uppercase">or paste email text</span>
                      </div>
                    </div>

                    <textarea
                      value={emailText}
                      onChange={(e) => setEmailText(e.target.value)}
                      placeholder="Paste the full email content here (including any pricing tables, product codes, and quantities)..."
                      rows={6}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 resize-y"
                    />

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="purple"
                        onClick={handleEmailTextSubmit}
                        disabled={emailText.trim().length < 50}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                        </svg>
                        Analyse Email
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Screenshot mode */}
            {inputMode === 'screenshot' && (
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropEvent}
                  onClick={() => !uploading && !imageData && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                    uploading ? 'border-blue-300 bg-blue-50' :
                    imageData ? 'border-slate-200 bg-slate-50' :
                    'border-slate-300 hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  {uploading ? (
                    <div>
                      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <p className="text-sm font-medium text-blue-700">Analysing screenshot...</p>
                      <p className="text-xs text-blue-500 mt-1">Extracting pricing via OCR</p>
                    </div>
                  ) : imageData ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={imageData.previewUrl}
                        alt="Screenshot preview"
                        className="max-h-48 rounded object-contain"
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImageData(null) }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                      <p className="text-sm font-medium text-slate-700">Paste screenshot (Ctrl+V) or drop image here</p>
                      <p className="text-xs text-slate-400 mt-1">or click to browse (PNG, JPEG, WebP, max 5MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleScreenshotFile(file)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="hidden"
                />

                {imageData && !uploading && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="purple"
                      onClick={handleScreenshotSubmit}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                      </svg>
                      Analyse Screenshot
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review */}
        {step === 'review' && lookups && (
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            {/* Extraction info */}
            {extracted?.supplier_name && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-medium">{extracted.supplier_name}</span>
                {extracted.supplier_reference && (
                  <span className="text-slate-400">Ref: {extracted.supplier_reference}</span>
                )}
                {extracted.sender_email && (
                  <span className="text-slate-400 text-xs">{extracted.sender_email}</span>
                )}
                {supplierMatch && supplierMatch.match_confidence !== 'none' && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    supplierMatch.match_confidence === 'exact' ? 'text-green-700 bg-green-100' : 'text-amber-700 bg-amber-100'
                  }`}>
                    {supplierMatch.match_method === 'email_domain' ? 'Domain matched' : 'Supplier matched'}
                  </span>
                )}
              </div>
            )}

            {/* New supplier banner */}
            {newSupplierName && !supplierId && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span className="text-amber-800">
                  <strong>{newSupplierName}</strong> will be created as a new supplier when you {isMerge ? 'add these lines' : 'create this quote'}.
                </span>
                <button
                  onClick={() => setNewSupplierName(null)}
                  className="ml-auto text-amber-600 hover:text-amber-800 text-xs underline"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Header fields */}
            <div className={`grid grid-cols-1 ${isMerge ? '' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-3 mb-5`}>
              <SearchableSelect
                label="Supplier"
                required
                value={supplierId}
                options={supplierOptions}
                placeholder="Search suppliers..."
                onChange={handleSupplierChange}
                createOption={!supplierId && extracted?.supplier_name ? supplierCreateOption : null}
              />
              {!isMerge && (
                <>
                  <SearchableSelect
                    label="Customer"
                    required
                    value={customerId}
                    options={customerOptions}
                    placeholder="Search customers..."
                    onChange={(id) => {
                      setCustomerId(id)
                      setContactId('')
                      // Auto-populate quote_type and brand from customer type
                      const cust = lookups?.customers.find((c) => c.id === id)
                      if (cust?.customer_type) {
                        setQuoteType(cust.customer_type)
                        const matching = (lookups?.brands || []).filter((b) => !b.customer_type || b.customer_type === cust.customer_type)
                        if (!matching.some((b) => b.id === brandId)) {
                          const preferred = matching[0]
                          if (preferred) setBrandId(preferred.id)
                        }
                        if (matching.length === 1) setBrandId(matching[0].id)
                      }
                    }}
                  />
                  <SearchableSelect
                    label="Contact"
                    value={contactId}
                    options={filteredContacts.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                    placeholder="Search contacts..."
                    onChange={(id) => setContactId(id)}
                    disabled={!customerId}
                  />
                  <SearchableSelect
                    label="Assigned To"
                    value={assignedTo}
                    options={lookups.users.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
                    placeholder="Search users..."
                    onChange={(id) => setAssignedTo(id)}
                  />
                  <SearchableSelect
                    label="Brand"
                    value={brandId}
                    options={filteredBrands.map((b) => ({ value: b.id, label: b.name }))}
                    placeholder="Search brands..."
                    onChange={(id) => setBrandId(id)}
                  />
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Quote Title</label>
                    <input
                      type="text"
                      value={quoteTitle}
                      onChange={(e) => setQuoteTitle(e.target.value)}
                      placeholder="e.g. Network Refresh Phase 2"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Quote Type</label>
                    <select
                      value={quoteType}
                      onChange={(e) => setQuoteType(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="">Select type...</option>
                      <option value="business">Business</option>
                      <option value="education">Education</option>
                      <option value="charity">Charity</option>
                      <option value="public_sector">Public Sector</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Lines table */}
            <div className="rounded-lg border border-slate-200 overflow-x-auto mb-4">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-8"></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Product Match</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide w-16">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide w-24">Buy</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide w-24">Sell</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wide w-16">Skip</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${line.ignored ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(i, { description: e.target.value })}
                          disabled={line.ignored}
                          className="w-full bg-transparent border-0 outline-none text-sm p-0 focus:ring-0 disabled:text-slate-400"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                        {line.product_code || '\u2014'}
                      </td>
                      <td className="px-3 py-2">
                        <ProductMatchCell
                          line={line}
                          lineIndex={i}
                          onSelectProduct={(p) => selectProduct(i, p)}
                          onClearMatch={() => clearProductMatch(i)}
                          onStartCreate={() => setQuickCreate({
                            lineIndex: i,
                            sku: line.product_code || '',
                            name: line.description,
                            categoryId: '',
                          })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value) || 1 })}
                          disabled={line.ignored}
                          className="w-16 text-right bg-transparent border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-slate-400 disabled:border-transparent disabled:text-slate-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={line.buy_price}
                          onChange={(e) => updateLine(i, { buy_price: parseFloat(e.target.value) || 0 })}
                          disabled={line.ignored}
                          className="w-24 text-right bg-transparent border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-slate-400 disabled:border-transparent disabled:text-slate-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={line.sell_price}
                          onChange={(e) => updateLine(i, { sell_price: parseFloat(e.target.value) || 0 })}
                          disabled={line.ignored}
                          className={`w-24 text-right bg-transparent border rounded px-2 py-1 text-sm outline-none focus:border-slate-400 disabled:border-transparent disabled:text-slate-400 ${
                            !line.ignored && line.sell_price === 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={line.ignored}
                          onChange={(e) => updateLine(i, { ignored: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick product create panel */}
            {quickCreate !== null && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">Quick Create Product</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">SKU *</label>
                    <input
                      type="text"
                      value={quickCreate.sku}
                      onChange={(e) => setQuickCreate({ ...quickCreate, sku: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
                    <input
                      type="text"
                      value={quickCreate.name}
                      onChange={(e) => setQuickCreate({ ...quickCreate, name: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleQuickCreate(quickCreate.lineIndex)}
                    disabled={!quickCreate.sku || !quickCreate.name || lines[quickCreate.lineIndex]?.creating_product}
                  >
                    {lines[quickCreate.lineIndex]?.creating_product ? 'Creating...' : 'Create & Link'}
                  </Button>
                  <Button size="sm" variant="default" onClick={() => setQuickCreate(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Footer stats */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span>Total buy: <strong>{formatCurrency(totalBuy)}</strong></span>
                <span className="text-green-600">{matchedCount} matched</span>
                {unmatchedCount > 0 && (
                  <span className="text-amber-600">{unmatchedCount} unmatched</span>
                )}
                <span>{activeLines.length} lines</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" onClick={() => { setStep('upload'); setError(''); setEmailText(''); setImageData(null) }}>
                  Back
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={creating || (!isMerge && !customerId) || (!supplierId && !newSupplierName)}
                >
                  {creating ? (isMerge ? 'Adding...' : 'Creating...') : (isMerge ? 'Add Lines' : 'Create Quote')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Sub-component for product match display ---

function ProductMatchCell({
  line,
  lineIndex,
  onSelectProduct,
  onClearMatch,
  onStartCreate,
}: {
  line: LineState
  lineIndex: number
  onSelectProduct: (product: { id: string; name: string; sku: string | null; default_sell_price: number }) => void
  onClearMatch: () => void
  onStartCreate: () => void
}) {
  const [showSuggestions, setShowSuggestions] = useState(false)

  if (line.ignored) return <span className="text-xs text-slate-400">-</span>

  // Exact or high match
  if (line.product_id && (line.match_confidence === 'exact' || line.match_confidence === 'high')) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
          line.match_confidence === 'exact' ? 'text-green-700 bg-green-100' : 'text-blue-700 bg-blue-100'
        }`}>
          {line.match_confidence === 'exact' ? 'Exact' : 'High'}
        </span>
        <span className="text-xs text-slate-600 truncate max-w-[140px]" title={line.product_name || ''}>
          {line.product_name}
        </span>
        <button
          onClick={onClearMatch}
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          Change
        </button>
      </div>
    )
  }

  // Low match (suggestion accepted)
  if (line.product_id && line.match_confidence === 'low') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium text-amber-700 bg-amber-100">
          Linked
        </span>
        <span className="text-xs text-slate-600 truncate max-w-[140px]" title={line.product_name || ''}>
          {line.product_name}
        </span>
        <button
          onClick={onClearMatch}
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          Change
        </button>
      </div>
    )
  }

  // Has suggestions but no match yet
  if (line.suggested_products.length > 0) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium text-amber-700 bg-amber-100">
            Possible
          </span>
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showSuggestions ? 'Hide' : `${line.suggested_products.length} suggestions`}
          </button>
          <button
            onClick={onStartCreate}
            className="text-xs text-purple-600 hover:underline"
          >
            Create
          </button>
        </div>
        {showSuggestions && (
          <div className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-64">
            {line.suggested_products.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelectProduct(p); setShowSuggestions(false) }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs"
              >
                <div className="font-medium text-slate-700">{p.name}</div>
                {p.sku && <div className="text-slate-400">{p.sku}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // No match at all
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium text-red-700 bg-red-100">
        No match
      </span>
      <button
        onClick={onStartCreate}
        className="text-xs text-purple-600 hover:underline"
      >
        Create
      </button>
    </div>
  )
}
