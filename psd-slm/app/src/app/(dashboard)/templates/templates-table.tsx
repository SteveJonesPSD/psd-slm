'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, TEMPLATE_CATEGORY_CONFIG, QUOTE_TYPE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/components/auth-provider'
import { formatDate } from '@/lib/utils'
import { TEMPLATE_CATEGORIES } from './template-editor-types'
import { CloneToQuoteModal } from './[id]/clone-to-quote-modal'

interface TemplateRow {
  id: string
  name: string
  description: string | null
  category: string | null
  default_quote_type: string | null
  created_at: string
  updated_at: string
  users: { id: string; first_name: string; last_name: string; initials: string | null; color: string | null } | null
  quote_template_groups: { id: string }[]
  quote_template_lines: { id: string }[]
}

interface TemplatesTableProps {
  templates: TemplateRow[]
}

export function TemplatesTable({ templates }: TemplatesTableProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreateQuote = hasPermission('quotes', 'create')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [cloneTemplate, setCloneTemplate] = useState<{ id: string; name: string } | null>(null)

  const filtered = useMemo(() => {
    let result = templates
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      )
    }
    if (categoryFilter) {
      result = result.filter((t) => t.category === categoryFilter)
    }
    return result
  }, [templates, search, categoryFilter])

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 w-64"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {TEMPLATE_CATEGORIES.map((cat) => {
            const cfg = TEMPLATE_CATEGORY_CONFIG[cat]
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cfg?.label || cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-400">No templates found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                  Template
                </th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                  Category
                </th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                  Quote Type
                </th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Groups
                </th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Lines
                </th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                  Created By
                </th>
                <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-left">
                  Updated
                </th>
                {canCreateQuote && (
                  <th className="whitespace-nowrap border-b-2 border-gray-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const catCfg = t.category ? TEMPLATE_CATEGORY_CONFIG[t.category] : null
                const typeCfg = t.default_quote_type ? QUOTE_TYPE_CONFIG[t.default_quote_type as keyof typeof QUOTE_TYPE_CONFIG] : null
                return (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/templates/${t.id}`)}
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{t.description}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {catCfg ? (
                        <Badge label={catCfg.label} color={catCfg.color} bg={catCfg.bg} />
                      ) : (
                        <span className="text-slate-400">{'\u2014'}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {typeCfg ? (
                        <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />
                      ) : (
                        <span className="text-slate-400">{'\u2014'}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center text-slate-600">
                      {t.quote_template_groups?.length || 0}
                    </td>
                    <td className="px-3.5 py-2.5 text-center text-slate-600">
                      {t.quote_template_lines?.length || 0}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {t.users ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar user={t.users as { id: string; first_name: string; last_name: string; initials: string | null; color: string | null }} size={22} />
                          <span className="text-xs text-slate-600">
                            {t.users.first_name} {t.users.last_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">{'\u2014'}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500">
                      {formatDate(t.updated_at)}
                    </td>
                    {canCreateQuote && (
                      <td className="px-3.5 py-2.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setCloneTemplate({ id: t.id, name: t.name })
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Create Quote
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Clone to Quote Modal */}
      {cloneTemplate && (
        <CloneToQuoteModal
          templateId={cloneTemplate.id}
          templateName={cloneTemplate.name}
          onClose={() => setCloneTemplate(null)}
        />
      )}
    </div>
  )
}
