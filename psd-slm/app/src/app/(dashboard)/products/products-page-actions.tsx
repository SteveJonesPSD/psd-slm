'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { AiCreateModal } from './ai-create-modal'

export function ProductsPageActions() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('products', 'create')

  const [aiModalMode, setAiModalMode] = useState<'url' | 'paste' | 'screenshot' | null>(null)
  const [showAiDropdown, setShowAiDropdown] = useState(false)
  const aiDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) {
        setShowAiDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <div className="flex items-center gap-2">
        {canCreate && (
          <div ref={aiDropdownRef} className="relative flex">
            <button
              type="button"
              onClick={() => setAiModalMode('screenshot')}
              className="inline-flex items-center rounded-l-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 transition-colors cursor-pointer"
            >
              Create with AI
            </button>
            <button
              type="button"
              onClick={() => setShowAiDropdown((v) => !v)}
              className="inline-flex items-center rounded-r-lg bg-purple-600 border-l border-purple-500 px-1.5 py-1.5 text-white hover:bg-purple-700 transition-colors cursor-pointer"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAiDropdown && (
              <div className="absolute right-0 z-20 mt-1 top-full w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => { setShowAiDropdown(false); setAiModalMode('screenshot') }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-sm font-medium text-slate-700">From Screenshot</span>
                  <span className="block text-xs text-slate-400">Upload or paste an image</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAiDropdown(false); setAiModalMode('url') }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-sm font-medium text-slate-700">From URL</span>
                  <span className="block text-xs text-slate-400">Fetch a product page</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAiDropdown(false); setAiModalMode('paste') }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-sm font-medium text-slate-700">From Web Page</span>
                  <span className="block text-xs text-slate-400">Paste page content</span>
                </button>
              </div>
            )}
          </div>
        )}
        {canCreate && (
          <Button size="sm" variant="primary" onClick={() => router.push('/products/new')}>
            + New Product
          </Button>
        )}
      </div>

      {aiModalMode && <AiCreateModal initialMode={aiModalMode} onClose={() => setAiModalMode(null)} />}
    </>
  )
}
