'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Badge, TEMPLATE_CATEGORY_CONFIG } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

interface TemplatePickerProps {
  onClose: () => void
  onSelect: (templateId: string, templateName: string) => void
}

interface TemplateOption {
  id: string
  name: string
  description: string | null
  category: string | null
  quote_template_groups: { id: string }[]
  quote_template_lines: { id: string }[]
}

export function TemplatePicker({ onClose, onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchTemplates = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('quote_templates')
        .select('id, name, description, category, quote_template_groups(id), quote_template_lines(id)')
        .eq('is_active', true)
        .order('sort_order')
        .order('name')

      setTemplates(data || [])
      setLoading(false)
    }
    fetchTemplates()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return templates
    const q = search.toLowerCase()
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
    )
  }, [templates, search])

  return (
    <Modal title="Choose a Template" onClose={onClose} width={550}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates..."
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 mb-4"
        autoFocus
      />

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading templates...</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          {templates.length === 0 ? 'No templates created yet.' : 'No templates match your search.'}
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {filtered.map((t) => {
            const catCfg = t.category ? TEMPLATE_CATEGORY_CONFIG[t.category] : null
            return (
              <button
                key={t.id}
                type="button"
                className="w-full text-left rounded-lg border border-slate-200 p-3 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                onClick={() => onSelect(t.id, t.name)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-slate-900">{t.name}</span>
                  {catCfg && <Badge label={catCfg.label} color={catCfg.color} bg={catCfg.bg} />}
                </div>
                {t.description && (
                  <p className="text-xs text-slate-500 line-clamp-1 mb-1">{t.description}</p>
                )}
                <div className="text-xs text-slate-400">
                  {t.quote_template_groups?.length || 0} groups, {t.quote_template_lines?.length || 0} lines
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
