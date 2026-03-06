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
              className="inline-flex items-center gap-1.5 rounded-l-lg border border-r-0 border-purple-500 bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-700 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] dark:border-purple-400 dark:bg-purple-400/15 dark:text-purple-300 dark:hover:shadow-[0_0_12px_rgba(192,132,252,0.4)] transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              Create with AI
            </button>
            <button
              type="button"
              onClick={() => setShowAiDropdown((v) => !v)}
              className="inline-flex items-center rounded-r-lg border border-purple-500 bg-purple-500/15 px-1.5 py-1.5 text-purple-700 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] dark:border-purple-400 dark:bg-purple-400/15 dark:text-purple-300 dark:hover:shadow-[0_0_12px_rgba(192,132,252,0.4)] transition-all cursor-pointer"
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
