'use client'

import { useReducer, useRef, useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  quoteFormReducer,
  createInitialState,
  loadExistingQuote,
  type CustomerLookup,
  type ContactLookup,
  type ProductLookup,
  type CategoryLookup,
  type SupplierLookup,
  type UserLookup,
  type ProductSupplierLookup,
  type BrandLookup,
} from './quote-builder-types'
import type { ActiveDealPricing } from '@/types/database'
import { MetadataSection } from './metadata-section'
import { AttributionEditor } from './attribution-editor'
import { LineItemsSection } from './line-items-section'
import { SummaryBar } from './summary-bar'
import { PageHeader } from '@/components/ui/page-header'
import { generateUUID } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createQuote, updateQuote, createSupplierQuick, attachSupplierPdfToQuote, refreshQuoteBuilderProducts, type GroupInput, type LineInput, type AttributionInput } from '../actions'
import { SupplierQuoteModal, type MergeLinesData } from '../supplier-quote-modal'

interface ExistingQuote {
  id: string
  quote_number: string
  customer_id: string
  contact_id: string | null
  opportunity_id: string | null
  assigned_to: string | null
  brand_id: string | null
  quote_type: string | null
  valid_until: string | null
  vat_rate: number
  customer_notes: string | null
  internal_notes: string | null
  quote_groups: { id: string; name: string; sort_order: number }[]
  quote_lines: {
    id: string; group_id: string | null; product_id: string | null; supplier_id: string | null;
    deal_reg_line_id: string | null; sort_order: number; description: string; quantity: number;
    buy_price: number; sell_price: number; fulfilment_route: string; is_optional: boolean;
    requires_contract: boolean; notes: string | null
  }[]
  quote_attributions: { id: string; user_id: string; attribution_type: string; split_pct: number }[]
}

interface QuoteBuilderProps {
  customers: CustomerLookup[]
  contacts: ContactLookup[]
  products: ProductLookup[]
  categories: CategoryLookup[]
  suppliers: SupplierLookup[]
  users: UserLookup[]
  brands: BrandLookup[]
  productSuppliers: ProductSupplierLookup[]
  dealPricing: ActiveDealPricing[]
  currentUserId: string
  existingQuote?: ExistingQuote
  opportunityId?: string | null
  opportunityCustomerId?: string | null
}

export function QuoteBuilder({
  customers,
  contacts,
  products,
  categories,
  suppliers,
  users,
  brands,
  productSuppliers,
  dealPricing,
  currentUserId,
  existingQuote,
  opportunityId,
  opportunityCustomerId,
}: QuoteBuilderProps) {
  const router = useRouter()
  const dirtyRef = useRef(false)

  const defaultBrandId = brands.find((b) => b.is_default)?.id || brands[0]?.id || ''

  const initialState = existingQuote
    ? {
        ...createInitialState(currentUserId),
        ...loadExistingQuote(
          existingQuote as unknown as Record<string, unknown>,
          existingQuote.quote_groups,
          existingQuote.quote_lines,
          existingQuote.quote_attributions,
          dealPricing
        ),
        brand_id: existingQuote.brand_id || defaultBrandId,
        saving: false,
        error: null,
      }
    : { ...createInitialState(currentUserId, opportunityCustomerId, opportunityId), brand_id: defaultBrandId }

  const [state, dispatch] = useReducer(quoteFormReducer, initialState)
  const [liveProducts, setLiveProducts] = useState(products)
  const [liveProductSuppliers, setLiveProductSuppliers] = useState(productSuppliers)

  const handleRefreshProducts = useCallback(async () => {
    const result = await refreshQuoteBuilderProducts()
    setLiveProducts(result.products)
    setLiveProductSuppliers(result.productSuppliers)
  }, [])

  // Track dirty state
  useEffect(() => {
    dirtyRef.current = true
  }, [state.customer_id, state.lines, state.groups, state.attributions])

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

    // Validation
    if (!state.customer_id) {
      dispatch({ type: 'SET_ERROR', error: 'Customer is required' })
      return
    }

    const nonEmptyLines = state.lines.filter((l) => l.description.trim())
    if (nonEmptyLines.length === 0) {
      dispatch({ type: 'SET_ERROR', error: 'At least one line item with a description is required' })
      return
    }

    const totalPct = state.attributions.reduce((sum, a) => sum + a.split_pct, 0)
    if (Math.abs(totalPct - 100) > 0.01) {
      dispatch({ type: 'SET_ERROR', error: `Attribution must total 100% (currently ${totalPct}%)` })
      return
    }

    const invalidAttrs = state.attributions.filter((a) => !a.user_id)
    if (invalidAttrs.length > 0) {
      dispatch({ type: 'SET_ERROR', error: 'All attribution rows must have a user selected' })
      return
    }

    dispatch({ type: 'SET_SAVING', saving: true })

    // Build FormData
    const formData = new FormData()
    formData.set('customer_id', state.customer_id)
    formData.set('contact_id', state.contact_id)
    formData.set('opportunity_id', state.opportunity_id)
    formData.set('assigned_to', state.assigned_to)
    formData.set('brand_id', state.brand_id)
    formData.set('quote_type', state.quote_type)
    formData.set('valid_until', state.valid_until)
    formData.set('vat_rate', String(state.vat_rate))
    formData.set('customer_notes', state.customer_notes)
    formData.set('internal_notes', state.internal_notes)

    // Build typed arrays
    const groups: GroupInput[] = state.groups.map((g) => ({
      tempId: g.tempId,
      name: g.name,
      sort_order: g.sort_order,
    }))

    const lines: LineInput[] = nonEmptyLines.map((l, i) => ({
      tempGroupId: l.tempGroupId,
      product_id: l.product_id,
      supplier_id: l.supplier_id,
      deal_reg_line_id: l.deal_reg_line_id,
      sort_order: i,
      description: l.description,
      quantity: l.quantity,
      buy_price: l.buy_price,
      sell_price: l.sell_price,
      fulfilment_route: l.fulfilment_route,
      is_optional: l.is_optional,
      requires_contract: l.requires_contract,
      notes: l.notes,
    }))

    const attributions: AttributionInput[] = state.attributions.map((a) => ({
      user_id: a.user_id,
      attribution_type: a.attribution_type,
      split_pct: a.split_pct,
    }))

    let result
    if (existingQuote) {
      result = await updateQuote(existingQuote.id, formData, groups, lines, attributions)
    } else {
      result = await createQuote(formData, groups, lines, attributions)
    }

    dispatch({ type: 'SET_SAVING', saving: false })

    if ('error' in result && result.error) {
      dispatch({ type: 'SET_ERROR', error: result.error })
      return
    }

    dirtyRef.current = false

    const quoteId = existingQuote?.id || ('data' in result ? result.data?.id : null)
    if (quoteId) {
      router.push(`/quotes/${quoteId}`)
    } else {
      router.push('/quotes')
    }
  }, [state, existingQuote, router])

  const isEdit = !!existingQuote

  // AI Quote merge modal state
  const [showSupplierImport, setShowSupplierImport] = useState(false)

  const handleMergeSupplierLines = useCallback(async (data: MergeLinesData) => {
    let resolvedSupplierId = data.supplierId

    // Auto-create supplier if needed
    if (!resolvedSupplierId && data.newSupplierName) {
      const result = await createSupplierQuick(data.newSupplierName)
      if ('error' in result && result.error) {
        dispatch({ type: 'SET_ERROR', error: result.error })
        return
      }
      if ('data' in result && result.data) {
        resolvedSupplierId = result.data.id
      }
    }

    // Add a new group with a pre-generated tempId
    const groupTempId = generateUUID()
    dispatch({ type: 'ADD_GROUP', name: data.groupName, tempId: groupTempId })

    // Add each line into the new group
    const existingLineCount = state.lines.length
    data.lines.forEach((line, i) => {
      dispatch({
        type: 'ADD_LINE',
        line: {
          tempId: generateUUID(),
          tempGroupId: groupTempId,
          product_id: line.product_id,
          supplier_id: resolvedSupplierId || line.supplier_id,
          deal_reg_line_id: null,
          sort_order: existingLineCount + i,
          description: line.description,
          quantity: line.quantity,
          buy_price: line.buy_price,
          sell_price: line.sell_price,
          fulfilment_route: 'drop_ship',
          is_optional: false,
          requires_contract: false,
          notes: null,
          original_deal_price: null,
        },
      })
    })

    // Attach the supplier PDF to the existing quote
    if (existingQuote && data.pdfStoragePath && data.pdfFileName) {
      attachSupplierPdfToQuote(existingQuote.id, data.pdfStoragePath, data.pdfFileName)
    }

    setShowSupplierImport(false)
  }, [state.lines.length, existingQuote])

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-3">
        <Link
          href={isEdit ? `/quotes/${existingQuote.id}` : '/quotes'}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 no-underline"
        >
          &larr; {isEdit ? 'Back to Quote' : 'All Quotes'}
        </Link>
        {isEdit && (
          <Button size="sm" variant="purple" onClick={() => setShowSupplierImport(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            AI Quote
          </Button>
        )}
      </div>

      <PageHeader
        title={isEdit ? `Edit ${existingQuote.quote_number}` : 'New Quote'}
        subtitle={isEdit ? 'Edit quote details, line items, and attributions' : 'Create a new quote with grouped line items'}
      />

      {isEdit && (
        <SupplierQuoteModal
          open={showSupplierImport}
          onClose={() => setShowSupplierImport(false)}
          mode="merge"
          existingQuoteId={existingQuote.id}
          onMergeLines={handleMergeSupplierLines}
        />
      )}

      <MetadataSection
        state={state}
        dispatch={dispatch}
        customers={customers}
        contacts={contacts}
        users={users}
        brands={brands}
      />

      <AttributionEditor
        attributions={state.attributions}
        dispatch={dispatch}
        users={users}
      />

      <LineItemsSection
        state={state}
        dispatch={dispatch}
        products={liveProducts}
        categories={categories}
        suppliers={suppliers}
        productSuppliers={liveProductSuppliers}
        dealPricing={dealPricing}
        onRefreshProducts={handleRefreshProducts}
      />

      <SummaryBar state={state} onSave={handleSave} />
    </div>
  )
}
