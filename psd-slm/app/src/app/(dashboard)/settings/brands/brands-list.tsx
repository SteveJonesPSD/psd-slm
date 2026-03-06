'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Brand } from '@/types/database'
import { deleteBrand, toggleBrandActive, setDefaultBrand } from '../actions'

interface Props {
  brands: Brand[]
}

export function BrandsList({ brands }: Props) {
  if (brands.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">No Brands Yet</h3>
        <p className="mb-4 text-sm text-slate-500">
          Create your first brand to start customising quotes and documents.
        </p>
        <Link href="/settings/brands/new">
          <Button variant="primary">Create Brand</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {brands.map((brand) => (
        <BrandCard key={brand.id} brand={brand} />
      ))}
    </div>
  )
}

function BrandCard({ brand }: { brand: Brand }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete "${brand.name}"? This cannot be undone.`)) return
    setLoading(true)
    const result = await deleteBrand(brand.id)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  const handleToggleActive = async () => {
    setLoading(true)
    await toggleBrandActive(brand.id, !brand.is_active)
    setLoading(false)
    setMenuOpen(false)
    router.refresh()
  }

  const handleSetDefault = async () => {
    setLoading(true)
    await setDefaultBrand(brand.id)
    setLoading(false)
    setMenuOpen(false)
    router.refresh()
  }

  return (
    <div className={`rounded-xl border bg-white p-5 transition-colors ${brand.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Logo or placeholder */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            {brand.logo_path ? (
              <img src={brand.logo_path} alt={brand.name} className="h-10 w-10 rounded object-contain" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{brand.name}</h3>
            {brand.legal_entity && (
              <p className="text-xs text-slate-500">{brand.legal_entity}</p>
            )}
            {(brand.city || brand.postcode) && (
              <p className="mt-0.5 text-xs text-slate-400">
                {[brand.city, brand.postcode].filter(Boolean).join(', ')}
              </p>
            )}
            {brand.phone && (
              <p className="text-xs text-slate-400">{brand.phone}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Badges */}
          <div className="flex items-center gap-1.5">
            {brand.is_default && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                Default
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              brand.is_active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {brand.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <Link
                    href={`/settings/brands/${brand.id}/edit`}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Edit
                  </Link>
                  {!brand.is_default && brand.is_active && (
                    <button
                      onClick={handleSetDefault}
                      disabled={loading}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    onClick={handleToggleActive}
                    disabled={loading}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {brand.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  {!brand.is_default && (
                    <button
                      onClick={handleDelete}
                      disabled={loading}
                      className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>
      )}

      {/* Edit link at bottom */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <Link
          href={`/settings/brands/${brand.id}/edit`}
          className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800"
        >
          Edit Brand Details
        </Link>
      </div>
    </div>
  )
}
