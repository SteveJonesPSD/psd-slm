'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { TemplatePicker } from '@/components/template-picker-modal'
import { CloneToQuoteModal } from '@/app/(dashboard)/templates/[id]/clone-to-quote-modal'

interface NewQuoteButtonProps {
  opportunityId: string
  customerId: string
}

export function NewQuoteButton({ opportunityId, customerId }: NewQuoteButtonProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  if (!hasPermission('quotes', 'create')) return null

  const canViewTemplates = hasPermission('templates', 'view')

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleBlankQuote = () => {
    setShowDropdown(false)
    router.push(`/quotes/new?opportunity_id=${opportunityId}`)
  }

  const handleFromTemplate = () => {
    setShowDropdown(false)
    setShowTemplatePicker(true)
  }

  const handleTemplateSelected = (templateId: string, templateName: string) => {
    setShowTemplatePicker(false)
    setSelectedTemplate({ id: templateId, name: templateName })
  }

  // If no templates permission, just show a simple button
  if (!canViewTemplates) {
    return (
      <Button
        size="sm"
        variant="primary"
        onClick={() => router.push(`/quotes/new?opportunity_id=${opportunityId}`)}
      >
        + New Quote
      </Button>
    )
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          + New Quote
        </Button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg z-50">
            <button
              type="button"
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 rounded-t-lg"
              onClick={handleBlankQuote}
            >
              Blank Quote
            </button>
            <button
              type="button"
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 rounded-b-lg border-t border-slate-100"
              onClick={handleFromTemplate}
            >
              From Template
            </button>
          </div>
        )}
      </div>

      {/* Template Picker */}
      {showTemplatePicker && (
        <TemplatePicker
          onClose={() => setShowTemplatePicker(false)}
          onSelect={handleTemplateSelected}
        />
      )}

      {/* Clone Modal — pre-fills customer and opportunity from the current context */}
      {selectedTemplate && (
        <CloneToQuoteModal
          templateId={selectedTemplate.id}
          templateName={selectedTemplate.name}
          onClose={() => setSelectedTemplate(null)}
          preSelectedCustomerId={customerId}
          preSelectedOpportunityId={opportunityId}
        />
      )}
    </>
  )
}
