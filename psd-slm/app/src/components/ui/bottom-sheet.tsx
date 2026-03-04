'use client'

import { useEffect, type ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  fullScreen?: boolean
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, fullScreen, children }: BottomSheetProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white shadow-xl transition-transform duration-300 ${
          fullScreen
            ? 'h-full rounded-none'
            : 'max-h-[85vh] rounded-t-2xl'
        } overflow-y-auto`}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 bg-white pt-3 pb-2 px-4">
          <div className="mx-auto h-1 w-10 rounded-full bg-gray-300" />
          {title && (
            <div className="mt-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="px-4 pb-6">
          {children}
        </div>
      </div>
    </>
  )
}
