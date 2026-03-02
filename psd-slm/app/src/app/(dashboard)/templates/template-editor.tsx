'use client'

import { useReducer, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  templateFormReducer,
  createInitialTemplateState,
  loadExistingTemplate,
  TEMPLATE_CATEGORIES,
  type TemplateFormState,
  type TemplateAction,
} from './template-editor-types'
import type { FormLine } from '../quotes/builder/quote-builder-types'
import type {
  ProductLookup,
  CategoryLookup,
  SupplierLookup,
  ProductSupplierLookup,
} from '../quotes/builder/quote-builder-types'
import { LineItemsSection } from '../quotes/builder/line-items-section'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { TEMPLATE_CATEGORY_CONFIG } from '@/components/ui/badge'
import {
  createTemplate,
  updateTemplate,
  type TemplateGroupInput,
  type TemplateLineInput,
} from './actions'

interface ExistingTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  default_quote_type: string | null
  is_active: boolean
  quote_template_groups: { id: string; name: string; sort_order: number }[]
  quote_template_lines: {
    id: string; group_id: string | null; product_id: string | null; supplier_id: string | null;
    sort_order: number; description: string; quantity: number;
    default_buy_price: number; default_sell_price: number;
    fulfilment_route: string; is_optional: boolean; requires_contract: boolean; notes: string | null
  }[]
}

interface TemplateEditorProps {
  products: ProductLookup[]
  categories: CategoryLookup[]
  suppliers: SupplierLookup[]
  productSuppliers: ProductSupplierLookup[]
  existingTemplate?: ExistingTemplate
}

export function TemplateEditor({
  products,
  categories,
  suppliers,
  productSuppliers,
  existingTemplate,
}: TemplateEditorProps) {
  const router = useRouter()
  const dirtyRef = useRef(false)

  const initialState: TemplateFormState = existingTemplate
    ? {
        ...createInitialTemplateState(),
        ...loadExistingTemplate(
          existingTemplate,
          existingTemplate.quote_template_groups,
          existingTemplate.quote_template_lines
        ),
        saving: false,
        error: null,
      }
    : createInitialTemplateState()

  const [state, dispatch] = useReducer(templateFormReducer, initialState)

  // Track dirty state
  useEffect(() => {
    dirtyRef.current = true
  }, [state.name, state.lines, state.groups])

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleSave = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', error: null })

    if (!state.name.trim()) {
      dispatch({ type: 'SET_ERROR', error: 'Template name is required' })
      return
    }

    const nonEmptyLines = state.lines.filter((l) => l.description.trim())
    if (nonEmptyLines.length === 0) {
      dispatch({ type: 'SET_ERROR', error: 'At least one line item with a description is required' })
      return
    }

    dispatch({ type: 'SET_SAVING', saving: true })

    // Build FormData
    const formData = new FormData()
    formData.set('name', state.name)
    formData.set('description', state.description)
    formData.set('category', state.category)
    formData.set('default_quote_type', state.default_quote_type)
    formData.set('is_active', String(state.is_active))

    const groups: TemplateGroupInput[] = state.groups.map((g) => ({
      tempId: g.tempId,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const lines: TemplateLineInput[] = nonEmptyLines.map((l, i) => ({
      tempGroupId: l.tempGroupId,
      product_id: l.product_id,
      supplier_id: l.supplier_id,
      sort_order: i,
      description: l.description,
      quantity: l.quantity,
      default_buy_price: l.buy_price,
      default_sell_price: l.sell_price,
      fulfilment_route: l.fulfilment_route,
      is_optional: l.is_optional,
      requires_contract: l.requires_contract,
      notes: l.notes,
    }))

    let result
    if (existingTemplate) {
      result = await updateTemplate(existingTemplate.id, formData, groups, lines)
    } else {
      result = await createTemplate(formData, groups, lines)
    }

    dispatch({ type: 'SET_SAVING', saving: false })

    if ('error' in result && result.error) {
      dispatch({ type: 'SET_ERROR', error: result.error })
      return
    }

    dirtyRef.current = false

    const templateId = existingTemplate?.id || ('data' in result ? result.data?.id : null)
    if (templateId) {
      router.push(`/templates/${templateId}`)
    } else {
      router.push('/templates')
    }
  }, [state, existingTemplate, router])

  const isEdit = !!existingTemplate

  // The LineItemsSection expects QuoteFormState; we adapt our TemplateFormState
  // by providing the fields it accesses (groups, lines, customer_id)
  const lineItemsState = {
    ...state,
    customer_id: '',
    contact_id: '',
    opportunity_id: '',
    assigned_to: '',
    brand_id: '',
    quote_type: '',
    valid_until: '',
    vat_rate: 20,
    customer_notes: '',
    internal_notes: '',
    attributions: [],
  }

  // Calculate totals for footer
  const nonOptionalLines = state.lines.filter((l) => !l.is_optional && l.description.trim())
  const totalCost = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.buy_price, 0)
  const totalSell = nonOptionalLines.reduce((sum, l) => sum + l.quantity * l.sell_price, 0)

  return (
    <div className="pb-24">
      <Link
        href={isEdit ? `/templates/${existingTemplate.id}` : '/templates'}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline mb-3"
      >
        &larr; {isEdit ? 'Back to Template' : 'All Templates'}
      </Link>

      <PageHeader
        title={isEdit ? `Edit: ${existingTemplate.name}` : 'New Template'}
        subtitle="Define a reusable quote structure with groups and product lines"
      />

      {/* Template Header Fields */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-4">
        <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Template Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'name', value: e.target.value })}
              placeholder="e.g. Standard Networking Package"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <select
              value={state.category}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'category', value: e.target.value })}
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

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              value={state.description}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'description', value: e.target.value })}
              placeholder="Brief description of what this template is used for..."
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {/* Default Quote Type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Quote Type</label>
            <select
              value={state.default_quote_type}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'default_quote_type', value: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="">None</option>
              <option value="business">Business</option>
              <option value="education">Education</option>
              <option value="charity">Charity</option>
              <option value="public_sector">Public Sector</option>
            </select>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2 pt-5">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={state.is_active}
                onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'is_active', value: e.target.checked })}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-500 peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm text-slate-600">Active</span>
          </div>
        </div>
      </div>

      {/* Line Items — reuse the quote builder's LineItemsSection */}
      <LineItemsSection
        state={lineItemsState}
        dispatch={dispatch as React.Dispatch<import('../quotes/builder/quote-builder-types').QuoteAction>}
        products={products}
        categories={categories}
        suppliers={suppliers}
        productSuppliers={productSuppliers}
        dealPricing={[]}
      />

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 z-50">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-slate-400">Lines: </span>
              <span className="font-semibold text-slate-700">{state.lines.filter((l) => l.description.trim()).length}</span>
            </div>
            <div>
              <span className="text-slate-400">Default Cost: </span>
              <span className="font-semibold text-slate-700">
                {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalCost)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Default Sell: </span>
              <span className="font-semibold text-slate-700">
                {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalSell)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {state.error && (
              <span className="text-sm text-red-600">{state.error}</span>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              disabled={state.saving}
            >
              {state.saving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
