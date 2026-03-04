'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea, Checkbox } from '@/components/ui/form-fields'
import { CurrencyInput } from '@/components/ui/currency-input'
import { MarginIndicator } from '@/components/ui/margin-indicator'
import { Badge } from '@/components/ui/badge'
import { createProduct, checkSkuUnique } from './actions'
import { createSupplier } from '../suppliers/actions'

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
  categories: Category[]
  suppliers: Supplier[]
  manufacturers: string[]
  source_url: string
}

type ModalState = 'idle' | 'loading' | 'paste' | 'review' | 'saving' | 'error'

const CONFIDENCE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High Confidence', color: '#059669', bg: '#ecfdf5' },
  medium: { label: 'Medium Confidence', color: '#d97706', bg: '#fffbeb' },
  low: { label: 'Low Confidence', color: '#dc2626', bg: '#fef2f2' },
}

interface CreateFromUrlModalProps {
  onClose: () => void
}

export function CreateFromUrlModal({ onClose }: CreateFromUrlModalProps) {
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)

  const [state, setState] = useState<ModalState>('idle')
  const [url, setUrl] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [error, setError] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

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
  const [supplierSku, setSupplierSku] = useState('')
  const [supplierCost, setSupplierCost] = useState<number | null>(null)
  const [supplierPreferred, setSupplierPreferred] = useState(true)
  const [supplierUrl, setSupplierUrl] = useState('')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [skuError, setSkuError] = useState('')
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

    setSupplierId(result.matched_supplier_id || '')
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
    fd.set('source', 'url')
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

  // --- Idle state: URL input ---
  if (state === 'idle') {
    return (
      <Modal title="Create Product from URL" onClose={onClose} width={500}>
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
            onClick={() => setState('paste')}
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
      <Modal title="Create Product from URL" onClose={onClose} width={500}>
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
          <p className="text-sm text-slate-600">
            {hostname ? `Analysing ${hostname}...` : 'Analysing content...'}
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
      <Modal title="Create Product from URL" onClose={onClose} width={600}>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
          <p className="text-xs text-amber-700">
            {hostname
              ? `${hostname} has bot protection that blocked automatic fetching.`
              : 'Some sites block automated access.'
            }
            {' '}Open the product page in your browser, select all the text (Ctrl+A), copy it (Ctrl+C), and paste it below.
          </p>
        </div>
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
          <button
            type="button"
            onClick={() => { setError(''); setState('idle') }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Back to URL
          </button>
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

  // --- Error state ---
  if (state === 'error') {
    return (
      <Modal title="Create Product from URL" onClose={onClose} width={500}>
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => router.push('/products/new')}>Create Manually</Button>
          <Button onClick={() => { setError(''); setState('paste') }}>
            Paste Content
          </Button>
          <Button
            variant="primary"
            onClick={() => { setError(''); setState('idle') }}
          >
            Try Again
          </Button>
        </div>
      </Modal>
    )
  }

  // --- Review / Saving state ---
  return (
    <Modal title="Create Product from URL" onClose={onClose} width={700}>
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
          Fields auto-populated from URL. Review and adjust before saving.
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
        <Select
          label="Category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Select category..."
          value={form.category_id}
          onChange={upd('category_id')}
          disabled={state === 'saving'}
        />

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
            <div className="flex items-end gap-1">
              <div className="flex-1">
                <Select
                  label="Supplier"
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  placeholder="Select supplier..."
                  value={supplierId}
                  onChange={(v) => setSupplierId(v)}
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
