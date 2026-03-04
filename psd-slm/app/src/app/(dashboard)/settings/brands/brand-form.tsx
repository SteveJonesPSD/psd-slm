'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input, Textarea, Checkbox } from '@/components/ui/form-fields'
import { saveBrand } from '../actions'
import type { Brand } from '@/types/database'

interface Props {
  brand?: Brand
}

const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

export function BrandForm({ brand }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEdit = !!brand

  const [form, setForm] = useState({
    name: brand?.name || '',
    legal_entity: brand?.legal_entity || '',
    is_default: brand?.is_default || false,
    is_active: brand?.is_active ?? true,
    quote_prefix: brand?.quote_prefix || 'Q',
    address_line1: brand?.address_line1 || '',
    address_line2: brand?.address_line2 || '',
    city: brand?.city || '',
    county: brand?.county || '',
    postcode: brand?.postcode || '',
    country: brand?.country || 'GB',
    registered_address: brand?.registered_address || '',
    phone: brand?.phone || '',
    fax: brand?.fax || '',
    email: brand?.email || '',
    website: brand?.website || '',
    company_reg_number: brand?.company_reg_number || '',
    vat_number: brand?.vat_number || '',
    footer_text: brand?.footer_text || '',
    default_terms: brand?.default_terms || '',
    default_payment_terms_text: brand?.default_payment_terms_text || '',
    customer_type: brand?.customer_type || '',
    logo_width: brand?.logo_width || 200,
  })

  const [logoPreview, setLogoPreview] = useState<string | null>(brand?.logo_path || null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (key: string, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Logo must be PNG, JPG, or SVG format.')
      return
    }
    if (file.size > MAX_LOGO_SIZE) {
      setError('Logo must be under 2MB.')
      return
    }

    setLogoFile(file)
    setRemoveLogo(false)
    setError(null)

    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setRemoveLogo(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Trading name is required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Upload logo if new file selected
      let logoPath = brand?.logo_path || null

      if (logoFile) {
        const formData = new FormData()
        formData.append('file', logoFile)
        if (brand?.id) formData.append('brandId', brand.id)
        if (brand?.logo_path) formData.append('oldPath', brand.logo_path)

        const uploadRes = await fetch('/api/settings/upload-logo', {
          method: 'POST',
          body: formData,
        })
        const uploadData = await uploadRes.json()

        if (!uploadRes.ok || uploadData.error) {
          setError(uploadData.error || 'Failed to upload logo.')
          setSaving(false)
          return
        }
        logoPath = uploadData.url
      } else if (removeLogo && brand?.logo_path) {
        // Delete old logo
        const formData = new FormData()
        formData.append('delete', 'true')
        formData.append('oldPath', brand.logo_path)

        await fetch('/api/settings/upload-logo', {
          method: 'POST',
          body: formData,
        })
        logoPath = null
      }

      const brandData = {
        ...form,
        customer_type: (form.customer_type || null) as Brand['customer_type'],
        logo_path: logoPath,
      }

      const result = await saveBrand(brandData, brand?.id)

      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }

      router.push('/settings/brands')
      router.refresh()
    } catch {
      setError('An unexpected error occurred.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Brand Identity */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Brand Identity</h3>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Trading Name *"
              value={form.name}
              onChange={(v) => update('name', v)}
              placeholder="PSD Group"
            />
            <Input
              label="Legal Entity Name"
              value={form.legal_entity}
              onChange={(v) => update('legal_entity', v)}
              placeholder="PSD Technical Services Limited"
            />
          </div>

          {/* Logo upload */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Logo</label>
            <div className="flex items-start gap-4">
              <div
                className="flex h-24 w-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer transition-colors hover:border-slate-300"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-h-20 max-w-36 object-contain"
                    style={{ width: form.logo_width > 144 ? 144 : form.logo_width }}
                  />
                ) : (
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="mt-1 block text-[10px] text-slate-400">Click to upload</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoSelect}
                className="hidden"
              />
              <div className="space-y-2">
                <p className="text-xs text-slate-500">PNG, JPG or SVG. Max 2MB.</p>
                {logoPreview && (
                  <button
                    onClick={handleRemoveLogo}
                    className="text-xs font-medium text-red-600 transition-colors hover:text-red-800"
                  >
                    Remove Logo
                  </button>
                )}
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">
                    Display Width: {form.logo_width}px
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="400"
                    value={form.logo_width}
                    onChange={(e) => update('logo_width', parseInt(e.target.value))}
                    className="h-1.5 w-40"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Quote Number Prefix"
              value={form.quote_prefix}
              onChange={(v) => update('quote_prefix', v)}
              placeholder="Q"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Customer Type</label>
              <select
                value={form.customer_type}
                onChange={(e) => update('customer_type', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">None (all types)</option>
                <option value="business">Business</option>
                <option value="education">Education</option>
                <option value="charity">Charity</option>
                <option value="public_sector">Public Sector</option>
              </select>
              <p className="mt-1 text-[10px] text-slate-400">Associates this brand with a specific customer type</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-end pb-1">
              <Checkbox
                label="Default brand"
                checked={form.is_default}
                onChange={(v) => update('is_default', v)}
              />
            </div>
            <div className="flex items-end pb-1">
              <Checkbox
                label="Active"
                checked={form.is_active}
                onChange={(v) => update('is_active', v)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Address</h3>
        </div>
        <div className="space-y-4 p-6">
          <Input label="Address Line 1" value={form.address_line1} onChange={(v) => update('address_line1', v)} />
          <Input label="Address Line 2" value={form.address_line2} onChange={(v) => update('address_line2', v)} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="City" value={form.city} onChange={(v) => update('city', v)} />
            <Input label="County" value={form.county} onChange={(v) => update('county', v)} />
            <Input label="Postcode" value={form.postcode} onChange={(v) => update('postcode', v)} />
          </div>
          <Input label="Country" value={form.country} onChange={(v) => update('country', v)} />
          <Textarea
            label="Registered Address (if different from above)"
            value={form.registered_address}
            onChange={(v) => update('registered_address', v)}
            rows={2}
          />
        </div>
      </div>

      {/* Contact Details */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Contact Details</h3>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={(v) => update('phone', v)} />
            <Input label="Fax" value={form.fax} onChange={(v) => update('fax', v)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Email" value={form.email} onChange={(v) => update('email', v)} type="email" />
            <Input label="Website" value={form.website} onChange={(v) => update('website', v)} />
          </div>
        </div>
      </div>

      {/* Legal & Financial */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Legal & Financial</h3>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Company Registration Number" value={form.company_reg_number} onChange={(v) => update('company_reg_number', v)} />
            <Input label="VAT Registration Number" value={form.vat_number} onChange={(v) => update('vat_number', v)} />
          </div>
          <Textarea
            label="Footer Text"
            value={form.footer_text}
            onChange={(v) => update('footer_text', v)}
            rows={2}
            placeholder="Trading names line for document footers..."
          />
        </div>
      </div>

      {/* Document Defaults */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Document Defaults</h3>
        </div>
        <div className="space-y-4 p-6">
          <Textarea
            label="Default Terms & Conditions"
            value={form.default_terms}
            onChange={(v) => update('default_terms', v)}
            rows={4}
          />
          <Input
            label="Default Payment Terms Text"
            value={form.default_payment_terms_text}
            onChange={(v) => update('default_payment_terms_text', v)}
            placeholder="Payment is due within 30 days of invoice date"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Document Header Preview</h3>
        </div>
        <div className="p-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="object-contain"
                    style={{ width: form.logo_width, maxWidth: '100%' }}
                  />
                ) : (
                  <div className="rounded bg-slate-100 px-4 py-2 text-xs text-slate-400 inline-block">
                    [No logo]
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-300 tracking-wide mb-2">QUOTATION</p>
                <h4 className="text-sm font-bold text-slate-900">{form.name || 'Brand Name'}</h4>
                {form.legal_entity && (
                  <p className="text-xs text-slate-500">{form.legal_entity}</p>
                )}
                <div className="text-xs text-slate-600 mt-1">
                  {form.address_line1 && <p>{form.address_line1}</p>}
                  {form.address_line2 && <p>{form.address_line2}</p>}
                  {(form.city || form.county || form.postcode) && (
                    <p>{[form.city, form.county, form.postcode].filter(Boolean).join(', ')}</p>
                  )}
                  {form.phone && <p className="mt-1">Tel: {form.phone}</p>}
                  {form.fax && <p>Fax: {form.fax}</p>}
                  {form.email && <p>{form.email}</p>}
                  {form.website && <p>{form.website}</p>}
                </div>
              </div>
            </div>
            {(form.company_reg_number || form.vat_number) && (
              <div className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
                {form.company_reg_number && <span>Reg: {form.company_reg_number}</span>}
                {form.company_reg_number && form.vat_number && <span className="mx-2">|</span>}
                {form.vat_number && <span>VAT: {form.vat_number}</span>}
              </div>
            )}
            {form.footer_text && (
              <p className="mt-2 text-[10px] text-slate-400 italic">{form.footer_text}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings/brands"
          className="text-sm text-slate-500 transition-colors hover:text-slate-700"
        >
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Brand'}
        </button>
      </div>
    </div>
  )
}
