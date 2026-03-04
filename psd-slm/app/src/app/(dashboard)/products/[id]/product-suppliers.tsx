'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/form-fields'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Checkbox } from '@/components/ui/form-fields'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency } from '@/lib/utils'
import { linkSupplier, updateProductSupplierLink, removeProductSupplierLink } from './link-actions'
import { createSupplier } from '../../suppliers/actions'

interface ProductSupplierRow {
  id: string
  product_id: string
  supplier_id: string
  supplier_sku: string | null
  standard_cost: number | null
  lead_time_days: number | null
  is_preferred: boolean
  url: string | null
  suppliers: { id: string; name: string; account_number: string | null; is_active: boolean }
}

interface ProductSuppliersProps {
  productId: string
  productName: string
  productSuppliers: ProductSupplierRow[]
}

export function ProductSuppliers({ productId, productName, productSuppliers }: ProductSuppliersProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('products', 'edit_all')

  const [showLink, setShowLink] = useState(false)
  const [editing, setEditing] = useState<ProductSupplierRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; account_number: string | null }[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; name: string; account_number: string | null } | null>(null)
  const [linkForm, setLinkForm] = useState({ supplier_sku: '', standard_cost: null as number | null, lead_time_days: '', is_preferred: false, url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddSaving, setQuickAddSaving] = useState(false)
  const [quickAddError, setQuickAddError] = useState('')

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
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
    setSearchResults(data || [])
  }

  const handleOpenLink = () => {
    setShowLink(true)
    setSelectedSupplier(null)
    setSearchQuery('')
    setSearchResults([])
    setLinkForm({ supplier_sku: '', standard_cost: null, lead_time_days: '', is_preferred: false, url: '' })
    setError('')
  }

  const handleOpenEdit = (ps: ProductSupplierRow) => {
    setEditing(ps)
    setLinkForm({
      supplier_sku: ps.supplier_sku || '',
      standard_cost: ps.standard_cost,
      lead_time_days: ps.lead_time_days?.toString() || '',
      is_preferred: ps.is_preferred,
      url: ps.url || '',
    })
    setError('')
  }

  const handleSaveLink = async () => {
    if (!selectedSupplier) return
    setSaving(true)
    setError('')
    const fd = new FormData()
    fd.set('product_id', productId)
    fd.set('supplier_id', selectedSupplier.id)
    fd.set('supplier_sku', linkForm.supplier_sku)
    fd.set('standard_cost', linkForm.standard_cost?.toString() || '')
    fd.set('lead_time_days', linkForm.lead_time_days)
    fd.set('is_preferred', String(linkForm.is_preferred))
    fd.set('url', linkForm.url)

    const result = await linkSupplier(fd)
    setSaving(false)
    if (result.error) setError(result.error)
    else {
      setShowLink(false)
      router.refresh()
    }
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    setSaving(true)
    setError('')
    const fd = new FormData()
    fd.set('supplier_sku', linkForm.supplier_sku)
    fd.set('standard_cost', linkForm.standard_cost?.toString() || '')
    fd.set('lead_time_days', linkForm.lead_time_days)
    fd.set('is_preferred', String(linkForm.is_preferred))
    fd.set('url', linkForm.url)

    const result = await updateProductSupplierLink(editing.id, editing.product_id, fd)
    setSaving(false)
    if (result.error) setError(result.error)
    else {
      setEditing(null)
      router.refresh()
    }
  }

  const handleRemove = async (ps: ProductSupplierRow) => {
    if (!confirm(`Remove ${ps.suppliers.name} as a supplier for ${productName}?`)) return
    const result = await removeProductSupplierLink(ps.id, ps.product_id)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  const columns: Column<ProductSupplierRow>[] = [
    {
      key: 'name',
      label: 'Supplier',
      render: (r) => (
        <span
          className="font-semibold text-blue-600 hover:underline cursor-pointer"
          onClick={(e) => { e.stopPropagation(); router.push(`/suppliers/${r.supplier_id}`) }}
        >
          {r.suppliers.name}
        </span>
      ),
    },
    {
      key: 'supplier_sku',
      label: 'Supplier SKU',
      render: (r) => r.supplier_sku || '\u2014',
    },
    {
      key: 'standard_cost',
      label: 'Standard Cost',
      align: 'right',
      nowrap: true,
      render: (r) => r.standard_cost != null ? formatCurrency(r.standard_cost) : '\u2014',
    },
    {
      key: 'lead_time_days',
      label: 'Lead Time',
      render: (r) => r.lead_time_days ? `${r.lead_time_days} days` : '\u2014',
    },
    {
      key: 'is_preferred',
      label: 'Preferred',
      align: 'center',
      render: (r) => r.is_preferred ? <span className="text-amber-500" title="Preferred supplier">★</span> : null,
    },
    {
      key: 'url',
      label: 'URL',
      align: 'center',
      nowrap: true,
      render: (r) => r.url ? (
        <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:text-blue-800" title={r.url}>
          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      ) : <span className="text-slate-300">&mdash;</span>,
    },
    ...(canEdit
      ? [{
          key: 'actions' as const,
          label: '',
          render: (r: ProductSupplierRow) => (
            <div className="flex items-center gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenEdit(r) }}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRemove(r) }}>
                Remove
              </Button>
            </div>
          ),
        }]
      : []),
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold">Suppliers ({productSuppliers.length})</h3>
        {canEdit && (
          <Button size="sm" variant="primary" onClick={handleOpenLink}>
            + Link Supplier
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={productSuppliers}
        emptyMessage="No suppliers linked to this product."
      />

      {/* Link Supplier Modal */}
      {showLink && (
        <Modal title="Link Supplier" onClose={() => setShowLink(false)} width={500}>
          {!selectedSupplier ? (
            <div>
              <Input
                label="Search suppliers"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Type supplier name or account number..."
              />
              {searchResults.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSupplier(s)}
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
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <button
                  type="button"
                  onClick={() => { setQuickAddName(searchQuery); setQuickAddError(''); setShowQuickAdd(true) }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add &ldquo;{searchQuery}&rdquo; as new supplier
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm">
                {selectedSupplier.account_number && (
                  <span className="font-mono text-xs text-slate-400 mr-2">{selectedSupplier.account_number}</span>
                )}
                <span className="font-medium">{selectedSupplier.name}</span>
                <button onClick={() => setSelectedSupplier(null)} className="float-right text-slate-400 hover:text-slate-600">
                  Change
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Supplier SKU"
                  value={linkForm.supplier_sku}
                  onChange={(v) => setLinkForm((f) => ({ ...f, supplier_sku: v }))}
                />
                <CurrencyInput
                  label="Standard Cost"
                  value={linkForm.standard_cost}
                  onChange={(v) => setLinkForm((f) => ({ ...f, standard_cost: v }))}
                />
                <Input
                  label="Lead Time (days)"
                  type="number"
                  value={linkForm.lead_time_days}
                  onChange={(v) => setLinkForm((f) => ({ ...f, lead_time_days: v }))}
                />
                <Checkbox
                  label="Preferred supplier"
                  checked={linkForm.is_preferred}
                  onChange={(v) => setLinkForm((f) => ({ ...f, is_preferred: v }))}
                  className="self-end pb-2"
                />
              </div>
              <Input
                label="Product URL"
                value={linkForm.url}
                onChange={(v) => setLinkForm((f) => ({ ...f, url: v }))}
                placeholder="https://www.supplier.com/product/..."
              />
              {error && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setShowLink(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSaveLink} disabled={saving}>
                  {saving ? 'Linking...' : 'Link Supplier'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

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
                  setSelectedSupplier({ id: result.data.id, name: result.data.name, account_number: result.data.account_number })
                  setShowQuickAdd(false)
                  setSearchQuery('')
                  setSearchResults([])
                }
              }}
            >
              {quickAddSaving ? 'Creating...' : 'Create Supplier'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit Link Modal */}
      {editing && (
        <Modal title={`Edit Link \u2014 ${editing.suppliers.name}`} onClose={() => setEditing(null)} width={500}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Supplier SKU"
              value={linkForm.supplier_sku}
              onChange={(v) => setLinkForm((f) => ({ ...f, supplier_sku: v }))}
            />
            <CurrencyInput
              label="Standard Cost"
              value={linkForm.standard_cost}
              onChange={(v) => setLinkForm((f) => ({ ...f, standard_cost: v }))}
            />
            <Input
              label="Lead Time (days)"
              type="number"
              value={linkForm.lead_time_days}
              onChange={(v) => setLinkForm((f) => ({ ...f, lead_time_days: v }))}
            />
            <Checkbox
              label="Preferred supplier"
              checked={linkForm.is_preferred}
              onChange={(v) => setLinkForm((f) => ({ ...f, is_preferred: v }))}
              className="self-end pb-2"
            />
          </div>
          <Input
            label="Product URL"
            value={linkForm.url}
            onChange={(v) => setLinkForm((f) => ({ ...f, url: v }))}
            placeholder="https://www.supplier.com/product/..."
          />
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
