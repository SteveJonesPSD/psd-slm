'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { TEMPLATE_CATEGORY_CONFIG } from '@/components/ui/badge'
import { TEMPLATE_CATEGORIES } from '@/app/(dashboard)/templates/template-editor-types'
import { saveQuoteAsTemplate } from '@/app/(dashboard)/templates/actions'

interface SaveAsTemplateModalProps {
  quoteId: string
  defaultName: string
  onClose: () => void
}

export function SaveAsTemplateModal({ quoteId, defaultName, onClose }: SaveAsTemplateModalProps) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const result = await saveQuoteAsTemplate(quoteId, name, description || undefined, category || undefined)
    setSaving(false)
    if ('error' in result && result.error) {
      alert(result.error)
    } else if ('data' in result && result.data) {
      onClose()
      router.push(`/templates/${result.data.id}`)
    }
  }

  return (
    <Modal title="Save as Template" onClose={onClose} width={450}>
      <p className="text-sm text-slate-500 mb-4">
        Create a reusable template from this quote. Catalogue default pricing will be used (not deal-reg prices).
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="">None</option>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {TEMPLATE_CATEGORY_CONFIG[cat]?.label || cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button size="sm" variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={handleSave} disabled={!name.trim() || saving}>
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </Modal>
  )
}
