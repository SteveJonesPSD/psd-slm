'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/form-fields'
import { CurrencyInput } from '@/components/ui/currency-input'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'
import { createDealRegistration, updateDealRegistration } from './actions'

interface CustomerOption {
  id: string
  name: string
}

interface SupplierOption {
  id: string
  name: string
}

interface ProductOption {
  id: string
  sku: string
  name: string
  default_buy_price: number | null
}

interface UserOption {
  id: string
  first_name: string
  last_name: string
}

interface ExistingLine {
  id: string
  product_id: string
  registered_buy_price: number
  max_quantity: number | null
  notes: string | null
}

interface ExistingDealReg {
  id: string
  customer_id: string
  supplier_id: string
  title: string
  reference: string | null
  status: string
  registered_date: string | null
  expiry_date: string | null
  notes: string | null
  registered_by: string | null
  deal_registration_lines: ExistingLine[]
}

interface FormLine {
  tempId: string
  product_id: string
  product_name: string
  product_sku: string
  catalogue_price: number | null
  registered_buy_price: number | null
  max_quantity: string
  notes: string
}

interface Props {
  dealReg?: ExistingDealReg
  customers: CustomerOption[]
  suppliers: SupplierOption[]
  products: ProductOption[]
  users: UserOption[]
  currentUserId: string
}

let lineCounter = 0
function nextTempId() {
  return `temp-${++lineCounter}`
}

export function DealRegForm({ dealReg, customers, suppliers, products, users, currentUserId }: Props) {
  const router = useRouter()
  const { user: authUser } = useAuth()
  const isEdit = !!dealReg
  const isAdmin = authUser.role.name === 'super_admin' || authUser.role.name === 'admin'

  const [form, setForm] = useState({
    customer_id: dealReg?.customer_id || '',
    supplier_id: dealReg?.supplier_id || '',
    title: dealReg?.title || '',
    reference: dealReg?.reference || '',
    status: dealReg?.status || 'active',
    registered_date: dealReg?.registered_date || new Date().toISOString().split('T')[0],
    expiry_date: dealReg?.expiry_date || '',
    notes: dealReg?.notes || '',
    registered_by: dealReg?.registered_by || currentUserId,
  })

  const [lines, setLines] = useState<FormLine[]>(() => {
    if (dealReg?.deal_registration_lines) {
      return dealReg.deal_registration_lines.map((l) => {
        const product = products.find((p) => p.id === l.product_id)
        return {
          tempId: nextTempId(),
          product_id: l.product_id,
          product_name: product?.name || '',
          product_sku: product?.sku || '',
          catalogue_price: product?.default_buy_price ?? null,
          registered_buy_price: l.registered_buy_price,
          max_quantity: l.max_quantity != null ? String(l.max_quantity) : '',
          notes: l.notes || '',
        }
      })
    }
    return []
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')

  const upd = (field: string) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  // --- Product Lines ---

  const addLine = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    // Don't add if already in the list
    if (lines.some((l) => l.product_id === productId)) return

    setLines((prev) => [
      ...prev,
      {
        tempId: nextTempId(),
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        catalogue_price: product.default_buy_price,
        registered_buy_price: product.default_buy_price,
        max_quantity: '',
        notes: '',
      },
    ])
  }

  const removeLine = (tempId: string) => {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId))
  }

  const updateLine = (tempId: string, field: keyof FormLine, value: unknown) => {
    setLines((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, [field]: value } : l))
    )
  }

  // --- Save ---

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.customer_id) { setError('Customer is required'); return }
    if (!form.supplier_id) { setError('Supplier is required'); return }
    if (lines.length === 0) { setError('At least one product line is required'); return }

    const invalidLine = lines.find((l) => !l.registered_buy_price || l.registered_buy_price <= 0)
    if (invalidLine) {
      setError(`Product "${invalidLine.product_name}" requires a valid registered price`)
      return
    }

    setSaving(true)
    setError('')

    const fd = new FormData()
    fd.set('customer_id', form.customer_id)
    fd.set('supplier_id', form.supplier_id)
    fd.set('title', form.title.trim())
    fd.set('reference', form.reference.trim())
    fd.set('status', form.status)
    fd.set('registered_date', form.registered_date)
    fd.set('expiry_date', form.expiry_date)
    fd.set('notes', form.notes.trim())
    fd.set('registered_by', form.registered_by)

    const lineData = lines.map((l) => ({
      product_id: l.product_id,
      registered_buy_price: l.registered_buy_price!,
      max_quantity: l.max_quantity ? parseInt(l.max_quantity) : null,
      notes: l.notes.trim() || null,
    }))

    const result = isEdit
      ? await updateDealRegistration(dealReg.id, fd, lineData)
      : await createDealRegistration(fd, lineData)

    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else if ('data' in result && result.data) {
      router.push(`/deal-registrations/${result.data.id}`)
    } else {
      router.push(`/deal-registrations/${dealReg!.id}`)
    }
  }

  // Filter products not already added
  const availableProducts = products.filter(
    (p) => !lines.some((l) => l.product_id === p.id)
  )

  // Filtered customer/supplier lists
  const filteredCustomers = customerSearch
    ? customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    : customers

  const filteredSuppliers = supplierSearch
    ? suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
    : suppliers

  return (
    <div className="max-w-4xl">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-5">
        <h3 className="text-[15px] font-semibold mb-4">Deal Registration Details</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Customer *</label>
            <input
              type="text"
              placeholder="Search customers..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 mb-1"
            />
            <select
              value={form.customer_id}
              onChange={(e) => { upd('customer_id')(e.target.value); setCustomerSearch('') }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              size={customerSearch ? Math.min(filteredCustomers.length + 1, 6) : 1}
            >
              <option value="">Select customer...</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Supplier *</label>
            <input
              type="text"
              placeholder="Search suppliers..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 mb-1"
            />
            <select
              value={form.supplier_id}
              onChange={(e) => { upd('supplier_id')(e.target.value); setSupplierSearch('') }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              size={supplierSearch ? Math.min(filteredSuppliers.length + 1, 6) : 1}
            >
              <option value="">Select supplier...</option>
              {filteredSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <Input
            label="Title *"
            value={form.title}
            onChange={upd('title')}
            className="col-span-2"
          />
          <Input
            label="Reference"
            value={form.reference}
            onChange={upd('reference')}
            placeholder="Supplier's reference number"
          />
          <Select
            label="Status"
            value={form.status}
            onChange={upd('status')}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
          <Input
            label="Registered Date"
            type="date"
            value={form.registered_date}
            onChange={upd('registered_date')}
          />
          <Input
            label="Expiry Date"
            type="date"
            value={form.expiry_date}
            onChange={upd('expiry_date')}
          />
          {isAdmin ? (
            <Select
              label="Registered By"
              value={form.registered_by}
              onChange={upd('registered_by')}
              options={users.map((u) => ({
                value: u.id,
                label: `${u.first_name} ${u.last_name}`,
              }))}
            />
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Registered By</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {users.find((u) => u.id === form.registered_by)
                  ? `${users.find((u) => u.id === form.registered_by)!.first_name} ${users.find((u) => u.id === form.registered_by)!.last_name}`
                  : '\u2014'}
              </div>
            </div>
          )}
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={upd('notes')}
            className="col-span-2"
            rows={2}
          />
        </div>
      </div>

      {/* Product Lines Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold">Product Lines</h3>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addLine(e.target.value)
                  e.target.value = ''
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              value=""
            >
              <option value="">+ Add Product...</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No product lines added yet. Use the dropdown above to add products.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Product</th>
                  <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide text-right">Catalogue Price</th>
                  <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide text-right">Registered Price</th>
                  <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide text-right">Saving</th>
                  <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide text-right">Max Qty</th>
                  <th className="pb-2 pr-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Notes</th>
                  <th className="pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const saving =
                    line.catalogue_price != null && line.registered_buy_price != null
                      ? line.catalogue_price - line.registered_buy_price
                      : null

                  return (
                    <tr key={line.tempId} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{line.product_name}</div>
                        <div className="text-xs text-slate-400">{line.product_sku}</div>
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-500">
                        {line.catalogue_price != null
                          ? formatCurrency(line.catalogue_price)
                          : '\u2014'}
                      </td>
                      <td className="py-2 pr-3">
                        <CurrencyInput
                          value={line.registered_buy_price}
                          onChange={(v) => updateLine(line.tempId, 'registered_buy_price', v)}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {saving != null ? (
                          <span className={saving > 0 ? 'text-emerald-600 font-medium' : saving < 0 ? 'text-red-600' : 'text-slate-400'}>
                            {saving > 0 ? '+' : ''}{formatCurrency(saving)}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min="0"
                          value={line.max_quantity}
                          onChange={(e) => updateLine(line.tempId, 'max_quantity', e.target.value)}
                          placeholder="\u2014"
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-right outline-none focus:border-slate-400"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) => updateLine(line.tempId, 'notes', e.target.value)}
                          placeholder="Optional"
                          className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(line.tempId)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title="Remove line"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button onClick={() => router.back()}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving || !form.title.trim() || !form.customer_id || !form.supplier_id || lines.length === 0}
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Deal Registration'}
        </Button>
      </div>
    </div>
  )
}
