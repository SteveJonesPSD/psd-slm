'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/form-fields'
import { Checkbox } from '@/components/ui/form-fields'
import { CurrencyInput } from '@/components/ui/currency-input'
import { MarginIndicator } from '@/components/ui/margin-indicator'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/components/auth-provider'
import { createProduct, updateProduct, checkSkuUnique } from './actions'
import { createCategory } from './categories/actions'
import type { Product, ProductCategory } from '@/types/database'

interface PreferredSupplier {
  id: string
  name: string
  account_number: string | null
}

interface ProductFormProps {
  product?: Product & { category?: ProductCategory | null }
  categories: ProductCategory[]
  manufacturers?: string[]
  preferredSupplier?: PreferredSupplier
}

export function ProductForm({ product, categories: initialCategories, manufacturers = [], preferredSupplier }: ProductFormProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const isEdit = !!product
  const canManageCategories = hasPermission('products', 'create')

  const [categories, setCategories] = useState(initialCategories)
  const [form, setForm] = useState({
    product_type: product?.product_type || 'goods' as 'goods' | 'service',
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    category_id: product?.category_id || '',
    manufacturer: product?.manufacturer || '',
    default_buy_price: product?.default_buy_price ?? null,
    default_sell_price: product?.default_sell_price ?? null,
    is_serialised: product?.is_serialised === null ? 'null' : product?.is_serialised ? 'true' : product ? 'false' : 'null',
    is_stocked: product?.is_stocked ?? false,
    is_active: product?.is_active ?? true,
  })

  const isService = form.product_type === 'service'

  // When switching to service, check for supplier links to warn
  const [typeWarning, setTypeWarning] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [skuError, setSkuError] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)

  // Main supplier state
  const [selectedSupplier, setSelectedSupplier] = useState<PreferredSupplier | null>(preferredSupplier || null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierResults, setSupplierResults] = useState<PreferredSupplier[]>([])

  const handleSupplierSearch = async (query: string) => {
    setSupplierSearch(query)
    if (query.length < 2) {
      setSupplierResults([])
      return
    }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, account_number')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,account_number.ilike.%${query}%`)
      .limit(10)
    setSupplierResults(data || [])
  }

  const selectedCategory = categories.find((c) => c.id === form.category_id)

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleSkuBlur = async () => {
    if (!form.sku.trim()) {
      setSkuError('')
      return
    }
    const result = await checkSkuUnique(form.sku, product?.id)
    setSkuError(result.exists ? 'A product with this SKU already exists' : '')
  }

  // Serialisation inherit text
  const inheritText = selectedCategory
    ? `Inherit from category (${selectedCategory.requires_serial ? 'Yes' : 'No'})`
    : 'Inherit from category (No category selected \u2014 defaults to No)'

  const serialisationOptions = [
    { value: 'null', label: inheritText },
    { value: 'true', label: 'Always require serial numbers' },
    { value: 'false', label: 'Never require serial numbers' },
  ]

  // Manufacturer options: existing manufacturers + allow typing a new one
  const manufacturerOptions = manufacturers.map((m) => ({ value: m, label: m }))

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    setAddingCategory(true)
    const fd = new FormData()
    fd.set('name', newCategoryName.trim())
    fd.set('requires_serial', 'false')
    const result = await createCategory(fd)
    setAddingCategory(false)
    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      // Add the new category to local state and select it
      setCategories((prev) => [...prev, result.data])
      setForm((f) => ({ ...f, category_id: result.data.id }))
      setShowAddCategory(false)
      setNewCategoryName('')
    }
  }

  const handleSave = async () => {
    if (!form.sku.trim()) { setError('SKU is required'); return }
    if (!form.name.trim()) { setError('Product name is required'); return }
    if (skuError) { setError(skuError); return }

    setSaving(true)
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
    // Services: force is_serialised=false and is_stocked=false
    fd.set('is_serialised', isService ? 'false' : form.is_serialised)
    fd.set('is_stocked', isService ? 'false' : String(form.is_stocked))
    if (isEdit) fd.set('is_active', String(form.is_active))
    fd.set('main_supplier_id', selectedSupplier?.id || '')

    const result = isEdit
      ? await updateProduct(product.id, fd)
      : await createProduct(fd)

    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else if ('data' in result && result.data) {
      router.push(`/products/${result.data.id}`)
    } else {
      router.push(`/products/${product!.id}`)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-2xl">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Product Type Selector */}
        <div className="col-span-2 mb-1">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            Product Type
          </label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, product_type: 'goods' }))
                setTypeWarning('')
              }}
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
              onClick={async () => {
                setForm((f) => ({ ...f, product_type: 'service' }))
                // Warn if switching from goods with supplier links in edit mode
                if (isEdit && product?.product_type === 'goods' && preferredSupplier) {
                  setTypeWarning('This product has linked suppliers. Switching to service type won\u2019t remove these links, but services typically don\u2019t require suppliers.')
                } else {
                  setTypeWarning('')
                }
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                form.product_type === 'service'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Service
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {form.product_type === 'goods'
              ? 'Physical item (stocked, sourced, serialised)'
              : 'Labour, delivery, support, or other non-tangible'}
          </p>
          {typeWarning && (
            <p className="mt-1 text-xs text-amber-600">{typeWarning}</p>
          )}
        </div>

        <div>
          <Input
            label="SKU *"
            value={form.sku}
            onChange={upd('sku')}
            onBlur={handleSkuBlur}
          />
          {skuError && (
            <p className="mt-1 text-xs text-red-600">{skuError}</p>
          )}
        </div>
        <Input
          label="Name *"
          value={form.name}
          onChange={upd('name')}
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={upd('description')}
          className="col-span-2"
          rows={2}
        />

        {/* Category with inline Add button */}
        <div>
          <div className="flex items-end gap-2">
            <Select
              label="Category"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select category..."
              value={form.category_id}
              onChange={upd('category_id')}
              className="flex-1"
            />
            {canManageCategories && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddCategory(true)}
                title="Add new category"
                className="mb-0.5"
              >
                +
              </Button>
            )}
          </div>
        </div>

        {/* Manufacturer dropdown with option to type custom — hidden for services */}
        {!isService && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Manufacturer
            </label>
            <input
              list="manufacturer-list"
              value={form.manufacturer}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              placeholder="Select or type..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <datalist id="manufacturer-list">
              {manufacturers.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        )}

        {/* Main Supplier */}
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Main Supplier
          </label>
          {selectedSupplier ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {selectedSupplier.account_number && (
                <span className="font-mono text-xs text-slate-400">{selectedSupplier.account_number}</span>
              )}
              <span className="font-medium">{selectedSupplier.name}</span>
              <button
                type="button"
                onClick={() => { setSelectedSupplier(null); setSupplierSearch(''); setSupplierResults([]) }}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => handleSupplierSearch(e.target.value)}
                placeholder="Search suppliers by name or account number..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              {supplierResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full border border-slate-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                  {supplierResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSelectedSupplier(s); setSupplierSearch(''); setSupplierResults([]) }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                    >
                      {s.account_number && (
                        <span className="font-mono text-xs text-slate-400 mr-2">{s.account_number}</span>
                      )}
                      <span className="font-medium">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prices */}
        <div>
          <CurrencyInput
            label="Default Buy Price"
            value={form.default_buy_price}
            onChange={(v) => setForm((f) => ({ ...f, default_buy_price: v }))}
          />
          {isService && (
            <p className="mt-1 text-xs text-slate-400">Internal cost or subcontractor rate (£0 for own labour)</p>
          )}
        </div>
        <CurrencyInput
          label="Default Sell Price"
          value={form.default_sell_price}
          onChange={(v) => setForm((f) => ({ ...f, default_sell_price: v }))}
        />

        {/* Live margin preview */}
        <div className="col-span-2 text-sm text-slate-600">
          Margin:{' '}
          {form.default_buy_price != null && form.default_sell_price != null && form.default_sell_price > 0 ? (
            <MarginIndicator
              buyPrice={form.default_buy_price}
              sellPrice={form.default_sell_price}
              showAmount
            />
          ) : (
            <span className="text-slate-400">N/A</span>
          )}
        </div>

        {/* Serialisation - three-state selector — hidden for services */}
        {!isService && (
          <Select
            label="Serialisation"
            options={serialisationOptions}
            value={form.is_serialised}
            onChange={upd('is_serialised')}
            className="col-span-2"
          />
        )}

        {/* Stocked toggle — hidden for services */}
        {!isService && (
          <Checkbox
            label="PSD holds this item in stock"
            checked={form.is_stocked}
            onChange={(v) => setForm((f) => ({ ...f, is_stocked: v }))}
            className="col-span-2"
          />
        )}

        {isEdit && (
          <Checkbox
            label="Active"
            checked={form.is_active}
            onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            className="col-span-2"
          />
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={() => router.back()}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!form.sku.trim() || !form.name.trim() || !!skuError || saving}
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <Modal title="Add Category" onClose={() => setShowAddCategory(false)} width={400}>
          <Input
            label="Category Name *"
            value={newCategoryName}
            onChange={(v) => setNewCategoryName(v)}
            placeholder="e.g. Audio Visual"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => { setShowAddCategory(false); setNewCategoryName('') }}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim() || addingCategory}
            >
              {addingCategory ? 'Adding...' : 'Add Category'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
