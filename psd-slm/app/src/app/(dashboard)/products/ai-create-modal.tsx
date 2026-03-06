'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea, Checkbox } from '@/components/ui/form-fields'
import { CurrencyInput } from '@/components/ui/currency-input'
import { MarginIndicator } from '@/components/ui/margin-indicator'
import { Badge } from '@/components/ui/badge'
import { createProduct, checkSkuUnique } from './actions'
import { createSupplier } from '../suppliers/actions'
import { createCategory } from './categories/actions'

interface Category {
  id: string
  name: string
}

interface Supplier {
  id: string
  name: string
  account_number: string | null
}

interface ExtractedProduct {
  name: string
  sku: string | null
  description: string | null
  manufacturer: string | null
  supplier_name: string | null
  supplier_sku: string | null
  category_hint: string | null
  price: number | null
  price_is_ex_vat: boolean
  is_stocked: boolean
  is_serialised: boolean
  product_type: 'goods' | 'service'
  confidence: 'high' | 'medium' | 'low'
}

interface AnalyseResponse {
  extracted: ExtractedProduct
  matched_supplier_id: string | null
  matched_category_id: string | null
  supplier_guessed: boolean
  categories: Category[]
  suppliers: Supplier[]
  manufacturers: string[]
  source_url: string
}

type ModalState = 'idle' | 'loading' | 'paste' | 'screenshot' | 'review' | 'saving' | 'error'

const CONFIDENCE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High Confidence', color: '#059669', bg: '#ecfdf5' },
  medium: { label: 'Medium Confidence', color: '#d97706', bg: '#fffbeb' },
  low: { label: 'Low Confidence', color: '#dc2626', bg: '#fef2f2' },
}

export interface AiCreateModalProps {
  onClose: () => void
  initialMode?: 'url' | 'paste' | 'screenshot'
}

export function AiCreateModal({ onClose, initialMode = 'url' }: AiCreateModalProps) {
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const entryModeRef = useRef(initialMode)

  const [state, setState] = useState<ModalState>(() => {
    if (initialMode === 'paste') return 'paste'
    if (initialMode === 'screenshot') return 'screenshot'
    return 'idle'
  })
  const [url, setUrl] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [error, setError] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [pasteFromBotBlock, setPasteFromBotBlock] = useState(false)

  // Screenshot state
  const [imageBase64, setImageBase64] = useState('')
  const [imageMimeType, setImageMimeType] = useState('')
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState('')
  const [imageFileSize, setImageFileSize] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  // Review form state
  const [form, setForm] = useState({
    product_type: 'goods' as 'goods' | 'service',
    sku: '',
    name: '',
    description: '',
    category_id: '',
    manufacturer: '',
    default_buy_price: null as number | null,
    default_sell_price: null as number | null,
    is_serialised: 'null' as string,
    is_stocked: false,
  })

  const [supplierId, setSupplierId] = useState('')
  const [supplierGuessed, setSupplierGuessed] = useState(false)
  const [supplierSku, setSupplierSku] = useState('')
  const [supplierCost, setSupplierCost] = useState<number | null>(null)
  const [supplierPreferred, setSupplierPreferred] = useState(true)
  const [supplierUrl, setSupplierUrl] = useState('')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [skuError, setSkuError] = useState('')
  const [suggestedCategory, setSuggestedCategory] = useState('')
  const [creatingSuggestedCat, setCreatingSuggestedCat] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddSaving, setQuickAddSaving] = useState(false)
  const [quickAddError, setQuickAddError] = useState('')

  // Reference data for dropdowns
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [manufacturers, setManufacturers] = useState<string[]>([])

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const isValidUrl = (s: string) => {
    try {
      const parsed = new URL(s)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  const hostname = (() => {
    try { return new URL(url).hostname } catch { return '' }
  })()

  const populateFromResult = (result: AnalyseResponse) => {
    setForm({
      product_type: result.extracted.product_type,
      sku: result.extracted.sku || '',
      name: result.extracted.name || '',
      description: result.extracted.description || '',
      category_id: result.matched_category_id || '',
      manufacturer: result.extracted.manufacturer || '',
      default_buy_price: result.extracted.price,
      default_sell_price: null,
      is_serialised: result.extracted.is_serialised ? 'true' : 'false',
      is_stocked: result.extracted.is_stocked,
    })

    // Track suggested category when AI gives a hint but no match found
    if (!result.matched_category_id && result.extracted.category_hint) {
      setSuggestedCategory(result.extracted.category_hint)
    } else {
      setSuggestedCategory('')
    }

    setSupplierId(result.matched_supplier_id || '')
    setSupplierGuessed(result.supplier_guessed || false)
    setSupplierSku(result.extracted.supplier_sku || '')
    setSupplierCost(result.extracted.price)
    setSupplierPreferred(true)
    setSupplierUrl(result.source_url || '')
    setConfidence(result.extracted.confidence)
    setCategories(result.categories)
    setSuppliers(result.suppliers)
    setManufacturers(result.manufacturers)
    setSourceUrl(result.source_url)
  }

  const handleAnalyse = async () => {
    if (!isValidUrl(url)) {
      setError('Please enter a valid URL (https://...)')
      return
    }

    setState('loading')
    setError('')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/products/analyse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: abortRef.current.signal,
      })

      const data = await res.json()

      if (!res.ok) {
        // If bot protected, switch to paste mode
        if (data.code === 'BOT_PROTECTED') {
          setError('')
          setPasteFromBotBlock(true)
          setState('paste')
          return
        }
        setError(data.error || 'Failed to analyse URL')
        setState('error')
        return
      }

      populateFromResult(data as AnalyseResponse)
      setState('review')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState('idle')
        return
      }
      setError('Network error — could not reach the server')
      setState('error')
    }
  }

  const handleAnalysePasted = async () => {
    if (!pastedText.trim() || pastedText.trim().length < 50) {
      setError('Please paste more content — at least a few lines of product information')
      return
    }

    setState('loading')
    setError('')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/products/analyse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pastedText, source_url: url }),
        signal: abortRef.current.signal,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to analyse content')
        setState('paste')
        return
      }

      populateFromResult(data as AnalyseResponse)
      setState('review')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState('paste')
        return
      }
      setError('Network error — could not reach the server')
      setState('paste')
    }
  }

  // --- Screenshot handling ---

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
      // Strip the data:image/...;base64, prefix
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

  const handleAnalyseScreenshot = async () => {
    if (!imageBase64) return

    setState('loading')
    setError('')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/products/analyse-url', {
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

      populateFromResult(data as AnalyseResponse)
      setState('review')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState('screenshot')
        return
      }
      setError('Network error — could not reach the server')
      setState('screenshot')
    }
  }

  // Paste event listener for screenshot mode
  useEffect(() => {
    if (state !== 'screenshot') return

    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept paste when a text input is focused
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
  }, [state, handleScreenshotFile])

  const handleCancel = () => {
    abortRef.current?.abort()
    setState('idle')
  }

  const handleSkuBlur = async () => {
    if (!form.sku.trim()) {
      setSkuError('')
      return
    }
    const result = await checkSkuUnique(form.sku)
    setSkuError(result.exists ? 'A product with this SKU already exists' : '')
  }

  const handleSave = async () => {
    if (!form.sku.trim()) { setError('SKU is required'); return }
    if (!form.name.trim()) { setError('Product name is required'); return }
    if (skuError) { setError(skuError); return }

    setState('saving')
    setError('')

    const fd = new FormData()
    fd.set('sku', form.sku.trim())
    fd.set('name', form.name.trim())
    fd.set('description', form.description)
    fd.set('category_id', form.category_id)
    fd.set('manufacturer', form.manufacturer)
    fd.set('default_buy_price', form.default_buy_price?.toString() || '')
    fd.set('default_sell_price', form.default_sell_price?.toString() || '')
    fd.set('product_type', form.product_type)
    fd.set('is_serialised', form.product_type === 'service' ? 'false' : form.is_serialised)
    fd.set('is_stocked', form.product_type === 'service' ? 'false' : String(form.is_stocked))
    fd.set('main_supplier_id', supplierId)
    fd.set('source', imageBase64 ? 'screenshot' : sourceUrl ? 'url' : 'paste')
    fd.set('source_url', sourceUrl)
    fd.set('supplier_sku', supplierSku)
    fd.set('supplier_standard_cost', supplierCost?.toString() || '')
    fd.set('supplier_is_preferred', String(supplierPreferred))
    fd.set('supplier_url', supplierUrl)

    const result = await createProduct(fd)

    if (result.error) {
      setError(result.error)
      setState('review')
    } else if ('data' in result && result.data) {
      router.push(`/products/${result.data.id}`)
    }
  }

  const isService = form.product_type === 'service'

  // Dynamic modal title
  const modalTitle = (() => {
    switch (state) {
      case 'idle': return 'Create from URL'
      case 'paste': return 'Create from Web Page'
      case 'screenshot': return 'Create from Screenshot'
      case 'review':
      case 'saving': return 'Review Product'
      case 'loading': return imageBase64 ? 'Create from Screenshot' : pastedText ? 'Create from Web Page' : 'Create from URL'
      case 'error': return 'Create Product'
      default: return 'Create Product'
    }
  })()

  // --- Idle state: URL input ---
  if (state === 'idle') {
    return (
      <Modal title={modalTitle} onClose={onClose} width={500}>
        <p className="text-sm text-slate-500 mb-4">
          Paste a product page URL from a supplier or distributor website. We&apos;ll extract the product details automatically.
        </p>
        <Input
          label="Product Page URL"
          value={url}
          onChange={(v) => { setUrl(v); setError('') }}
          placeholder="https://www.supplier.com/product/..."
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setPasteFromBotBlock(false); setState('paste') }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Paste page content instead
          </button>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAnalyse}
            disabled={!url.trim()}
          >
            Analyse
          </Button>
        </div>
      </Modal>
    )
  }

  // --- Loading state ---
  if (state === 'loading') {
    return (
      <Modal title={modalTitle} onClose={onClose} width={500}>
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
          <p className="text-sm text-slate-600">
            {imageBase64
              ? 'Analysing screenshot...'
              : hostname
                ? `Analysing ${hostname}...`
                : 'Analysing content...'
            }
          </p>
          <p className="text-xs text-slate-400">This may take a few seconds</p>
          <Button size="sm" onClick={handleCancel} className="mt-2">
            Cancel
          </Button>
        </div>
      </Modal>
    )
  }

  // --- Paste state: manual content input ---
  if (state === 'paste') {
    return (
      <Modal title={modalTitle} onClose={onClose} width={600}>
        {pasteFromBotBlock ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
            <p className="text-xs text-amber-700">
              {hostname
                ? `${hostname} has bot protection that blocked automatic fetching.`
                : 'Some sites block automated access.'
              }
              {' '}Open the product page in your browser, select all the text (Ctrl+A), copy it (Ctrl+C), and paste it below.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
            <p className="text-xs text-blue-700">
              Paste the text content from a product page below. Select all (Ctrl+A), copy (Ctrl+C) from the supplier page, then paste here.
            </p>
          </div>
        )}
        {url && (
          <div className="mb-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Open {hostname || url} in browser
            </a>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Page Content
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => { setPastedText(e.target.value); setError('') }}
            placeholder="Paste the product page content here..."
            rows={8}
            className="w-full resize-vertical rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 font-[inherit]"
          />
          {pastedText.trim().length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              {pastedText.trim().length.toLocaleString()} characters
            </p>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
          {entryModeRef.current === 'url' && (
            <button
              type="button"
              onClick={() => { setError(''); setState('idle') }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Back to URL
            </button>
          )}
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAnalysePasted}
            disabled={!pastedText.trim()}
          >
            Analyse
          </Button>
        </div>
      </Modal>
    )
  }

  // --- Screenshot state: image input ---
  if (state === 'screenshot') {
    return (
      <Modal title={modalTitle} onClose={onClose} width={600}>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
          <p className="text-xs text-blue-700">
            Paste a screenshot (Ctrl+V) or upload an image of a product page.
          </p>
        </div>

        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

        {/* Drop zone */}
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
              ? 'border-blue-400 bg-blue-50'
              : imagePreviewUrl
                ? 'border-slate-200 bg-white'
                : 'border-slate-300 bg-slate-50 cursor-pointer hover:border-slate-400 hover:bg-slate-100'
          }`}
        >
          {imagePreviewUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={imagePreviewUrl}
                alt="Screenshot preview"
                className="max-h-64 rounded object-contain"
              />
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{imageFileName}</span>
                <span>({(imageFileSize / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearImage() }}
                  className="text-red-500 hover:text-red-700 font-medium"
                >
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
              <p className="text-xs text-slate-400">Click to browse</p>
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

        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleAnalyseScreenshot}
            disabled={!imageBase64}
          >
            Analyse
          </Button>
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
          <Button onClick={() => router.push('/products/new')}>Create Manually</Button>
          <Button onClick={() => { setError(''); setPasteFromBotBlock(false); setState('paste') }}>
            Paste Content
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setError('')
              if (entryModeRef.current === 'screenshot') {
                setState('screenshot')
              } else {
                setState('idle')
              }
            }}
          >
            Try Again
          </Button>
        </div>
      </Modal>
    )
  }

  // --- Review / Saving state ---
  return (
    <Modal title={modalTitle} onClose={onClose} width={700}>
      {/* Source URL + confidence */}
      <div className="flex items-center gap-2 mb-3">
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline truncate max-w-[400px]"
          >
            {sourceUrl}
          </a>
        )}
        <Badge {...CONFIDENCE_BADGE[confidence]} />
      </div>

      {/* Info banner */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
        <p className="text-xs text-blue-700">
          Fields auto-populated{sourceUrl ? ' from URL' : imageBase64 ? ' from screenshot' : ' from pasted content'}. Review and adjust before saving.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Product Type */}
        <div className="col-span-2 mb-1">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            Product Type
          </label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, product_type: 'goods' }))}
              disabled={state === 'saving'}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                form.product_type === 'goods'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Goods
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, product_type: 'service' }))}
              disabled={state === 'saving'}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                form.product_type === 'service'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Service
            </button>
          </div>
        </div>

        {/* SKU */}
        <div>
          <Input
            label="SKU *"
            value={form.sku}
            onChange={upd('sku')}
            onBlur={handleSkuBlur}
            disabled={state === 'saving'}
          />
          {skuError && <p className="mt-1 text-xs text-red-600">{skuError}</p>}
        </div>

        {/* Name */}
        <Input
          label="Name *"
          value={form.name}
          onChange={upd('name')}
          disabled={state === 'saving'}
        />

        {/* Description */}
        <Textarea
          label="Description"
          value={form.description}
          onChange={upd('description')}
          className="col-span-2"
          rows={2}
          disabled={state === 'saving'}
        />

        {/* Category */}
        <div>
          <Select
            label="Category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Select category..."
            value={form.category_id}
            onChange={(v) => { setForm((f) => ({ ...f, category_id: v })); if (v) setSuggestedCategory('') }}
            disabled={state === 'saving'}
          />
          {suggestedCategory && !form.category_id && (
            <div className="mt-1.5 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
              <p className="text-xs text-amber-700 flex-1">
                AI suggested <span className="font-semibold">&ldquo;{suggestedCategory}&rdquo;</span> which doesn&apos;t exist yet.
              </p>
              <button
                type="button"
                disabled={creatingSuggestedCat || state === 'saving'}
                onClick={async () => {
                  setCreatingSuggestedCat(true)
                  const fd = new FormData()
                  fd.set('name', suggestedCategory)
                  fd.set('requires_serial', 'false')
                  const result = await createCategory(fd)
                  setCreatingSuggestedCat(false)
                  if ('data' in result && result.data) {
                    const newCat = { id: result.data.id, name: result.data.name }
                    setCategories((prev) => [...prev, newCat])
                    setForm((f) => ({ ...f, category_id: result.data.id }))
                    setSuggestedCategory('')
                  }
                }}
                className="shrink-0 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {creatingSuggestedCat ? 'Creating...' : 'Create'}
              </button>
            </div>
          )}
        </div>

        {/* Manufacturer */}
        {!isService && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Manufacturer
            </label>
            <input
              list="url-manufacturer-list"
              value={form.manufacturer}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              placeholder="Select or type..."
              disabled={state === 'saving'}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-50"
            />
            <datalist id="url-manufacturer-list">
              {manufacturers.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        )}

        {/* Prices */}
        <CurrencyInput
          label="Default Buy Price"
          value={form.default_buy_price}
          onChange={(v) => setForm((f) => ({ ...f, default_buy_price: v }))}
          disabled={state === 'saving'}
        />
        <CurrencyInput
          label="Default Sell Price"
          value={form.default_sell_price}
          onChange={(v) => setForm((f) => ({ ...f, default_sell_price: v }))}
          disabled={state === 'saving'}
        />

        {/* Margin preview */}
        <div className="col-span-2 text-sm text-slate-600">
          Margin:{' '}
          {form.default_buy_price != null && form.default_sell_price != null && form.default_sell_price > 0 ? (
            <MarginIndicator buyPrice={form.default_buy_price} sellPrice={form.default_sell_price} showAmount />
          ) : (
            <span className="text-slate-400">N/A</span>
          )}
        </div>

        {/* Serialisation */}
        {!isService && (
          <Select
            label="Serialisation"
            options={[
              { value: 'null', label: 'Inherit from category' },
              { value: 'true', label: 'Always require serial numbers' },
              { value: 'false', label: 'Never require serial numbers' },
            ]}
            value={form.is_serialised}
            onChange={upd('is_serialised')}
            className="col-span-2"
            disabled={state === 'saving'}
          />
        )}

        {/* Stocked */}
        {!isService && (
          <Checkbox
            label="PSD holds this item in stock"
            checked={form.is_stocked}
            onChange={(v) => setForm((f) => ({ ...f, is_stocked: v }))}
            className="col-span-2"
          />
        )}

        {/* Supplier section */}
        <div className="col-span-2 border-t border-slate-100 pt-3 mt-1">
          <label className="mb-2 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Supplier Link
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-end gap-1">
                <div className="flex-1">
                  <Select
                    label="Supplier"
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    placeholder="Select supplier..."
                    value={supplierId}
                    onChange={(v) => { setSupplierId(v); setSupplierGuessed(false) }}
                    disabled={state === 'saving'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setQuickAddName(''); setQuickAddError(''); setShowQuickAdd(true) }}
                  disabled={state === 'saving'}
                  className="mb-[1px] flex items-center justify-center h-[38px] w-[38px] rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 shrink-0"
                  title="Add new supplier"
                >
                  +
                </button>
              </div>
              {supplierGuessed && (
                <div className="mt-1.5 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                  <svg className="h-3.5 w-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <p className="text-xs text-amber-700">
                    Supplier guessed from similar products — please verify.
                  </p>
                </div>
              )}
            </div>
            <Input
              label="Supplier SKU"
              value={supplierSku}
              onChange={(v) => setSupplierSku(v)}
              placeholder="Supplier's part number"
              disabled={state === 'saving'}
            />
            <CurrencyInput
              label="Standard Cost"
              value={supplierCost}
              onChange={(v) => setSupplierCost(v)}
              disabled={state === 'saving'}
            />
            <div className="flex items-end pb-1">
              <Checkbox
                label="Preferred supplier"
                checked={supplierPreferred}
                onChange={(v) => setSupplierPreferred(v)}
              />
            </div>
            <Input
              label="Product URL"
              value={supplierUrl}
              onChange={(v) => setSupplierUrl(v)}
              placeholder="https://www.supplier.com/product/..."
              disabled={state === 'saving'}
              className="col-span-2"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose} disabled={state === 'saving'}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!form.sku.trim() || !form.name.trim() || !!skuError || state === 'saving'}
        >
          {state === 'saving' ? 'Creating...' : 'Create Product'}
        </Button>
      </div>

      {/* Quick Add Supplier Modal */}
      {showQuickAdd && (
        <Modal title="Add New Supplier" onClose={() => setShowQuickAdd(false)} width={400}>
          <Input
            label="Supplier Name *"
            value={quickAddName}
            onChange={(v) => setQuickAddName(v)}
            placeholder="Enter supplier name..."
          />
          {quickAddError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {quickAddError}
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setShowQuickAdd(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!quickAddName.trim() || quickAddSaving}
              onClick={async () => {
                setQuickAddSaving(true)
                setQuickAddError('')
                const fd = new FormData()
                fd.set('name', quickAddName.trim())
                const result = await createSupplier(fd)
                setQuickAddSaving(false)
                if (result.error) {
                  setQuickAddError(result.error)
                } else if ('data' in result && result.data) {
                  const newSupplier = { id: result.data.id, name: result.data.name, account_number: result.data.account_number }
                  setSuppliers((prev) => [...prev, newSupplier])
                  setSupplierId(result.data.id)
                  setShowQuickAdd(false)
                }
              }}
            >
              {quickAddSaving ? 'Creating...' : 'Create Supplier'}
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
