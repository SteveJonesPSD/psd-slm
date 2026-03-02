import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth'
import { Badge, TEMPLATE_CATEGORY_CONFIG, QUOTE_TYPE_CONFIG, FULFILMENT_ROUTE_CONFIG } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TemplateDetailActions } from './template-detail-actions'
import type { User } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TemplateDetailPage({ params }: PageProps) {
  const { id } = await params
  await requirePermission('templates', 'view')
  const supabase = await createClient()

  const { data: template } = await supabase
    .from('quote_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (!template) notFound()

  const [
    { data: createdByUser },
    { data: groups },
    { data: lines },
  ] = await Promise.all([
    template.created_by
      ? supabase.from('users').select('id, first_name, last_name, initials, color').eq('id', template.created_by).single()
      : Promise.resolve({ data: null }),
    supabase.from('quote_template_groups').select('*').eq('template_id', id).order('sort_order'),
    supabase.from('quote_template_lines').select('*, products(name, sku), suppliers(name)').eq('template_id', id).order('sort_order'),
  ])

  const catCfg = template.category ? TEMPLATE_CATEGORY_CONFIG[template.category] : null
  const typeCfg = template.default_quote_type ? QUOTE_TYPE_CONFIG[template.default_quote_type as keyof typeof QUOTE_TYPE_CONFIG] : null

  type LineRow = {
    id: string; group_id: string | null; sort_order: number; description: string; quantity: number;
    default_buy_price: number; default_sell_price: number; fulfilment_route: string;
    is_optional: boolean; requires_contract: boolean; notes: string | null;
    products: { name: string; sku: string } | null; suppliers: { name: string } | null
  }
  const allLines = (lines || []) as LineRow[]

  // Calculate informational totals
  const totalCost = allLines.filter((l) => !l.is_optional).reduce((sum, l) => sum + l.quantity * l.default_buy_price, 0)
  const totalSell = allLines.filter((l) => !l.is_optional).reduce((sum, l) => sum + l.quantity * l.default_sell_price, 0)

  // Group lines
  type GroupRow = { id: string; name: string; sort_order: number }
  const typedGroups = (groups || []) as GroupRow[]
  const groupedLines = typedGroups.map((g) => ({
    ...g,
    lines: allLines.filter((l) => l.group_id === g.id).sort((a, b) => a.sort_order - b.sort_order),
  }))

  return (
    <div>
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; All Templates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{template.name}</h2>
            {catCfg && <Badge label={catCfg.label} color={catCfg.color} bg={catCfg.bg} />}
            {typeCfg && <Badge label={typeCfg.label} color={typeCfg.color} bg={typeCfg.bg} />}
            {!template.is_active && <Badge label="Inactive" color="#dc2626" bg="#fef2f2" />}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {template.description && <span>{template.description}</span>}
            {createdByUser && (
              <span className="flex items-center gap-1.5">
                <Avatar user={createdByUser as User} size={20} />
                {createdByUser.first_name} {createdByUser.last_name}
              </span>
            )}
            <span>Created {formatDate(template.created_at)}</span>
          </div>
        </div>

        <TemplateDetailActions templateId={template.id} templateName={template.name} />
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Groups</div>
          <div className="text-lg font-bold text-slate-900">{typedGroups.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Lines</div>
          <div className="text-lg font-bold text-slate-900">{allLines.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Default Cost</div>
          <div className="text-lg font-bold text-slate-900">{formatCurrency(totalCost)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Default Sell</div>
          <div className="text-lg font-bold text-slate-900">{formatCurrency(totalSell)}</div>
        </div>
      </div>

      {/* Grouped line items */}
      <div className="rounded-xl border border-gray-200 bg-white mb-5">
        <div className="px-5 py-4">
          <h3 className="text-[15px] font-semibold">Template Lines</h3>
        </div>

        {groupedLines.map((group) => (
          <div key={group.id}>
            <div className="bg-slate-50 border-t border-gray-200 px-5 py-2">
              <span className="text-sm font-semibold text-slate-700">{group.name}</span>
              <span className="ml-2 text-xs text-slate-400">({group.lines.length} items)</span>
            </div>
            {group.lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Route</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supplier</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Default Buy</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Default Sell</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.lines.map((line) => {
                      const lineTotal = line.quantity * line.default_sell_price
                      const supplier = line.suppliers as { name: string } | null
                      const routeCfg = FULFILMENT_ROUTE_CONFIG?.[line.fulfilment_route as keyof typeof FULFILMENT_ROUTE_CONFIG]

                      return (
                        <tr key={line.id} className={`border-t border-slate-100 ${line.is_optional ? 'bg-slate-50/50' : ''}`}>
                          <td className="px-5 py-2.5">
                            <span className={line.is_optional ? 'text-slate-500' : 'font-medium'}>{line.description}</span>
                            {line.products && (
                              <span className="ml-2 text-xs text-slate-400">{line.products.sku}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {routeCfg ? (
                              <Badge label={routeCfg.label} color={routeCfg.color} bg={routeCfg.bg} />
                            ) : (
                              <span className="text-xs text-slate-400">{line.fulfilment_route}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{supplier?.name || '\u2014'}</td>
                          <td className="px-3 py-2.5 text-right">{line.quantity}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500">{formatCurrency(line.default_buy_price)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500">{formatCurrency(line.default_sell_price)}</td>
                          <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(lineTotal)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              {line.is_optional && <Badge label="Optional" color="#6b7280" bg="#f3f4f6" />}
                              {line.requires_contract && <Badge label="Contract" color="#d97706" bg="#fffbeb" />}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {groupedLines.length === 0 && allLines.length === 0 && (
          <div className="border-t border-gray-200 px-5 py-8 text-center text-sm text-slate-400">
            No lines in this template.
          </div>
        )}
      </div>
    </div>
  )
}
