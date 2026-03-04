import type { ActiveDealPricing } from '@/types/database'
import { generateUUID } from '@/lib/utils'

// --- Form state types ---

export interface FormGroup {
  tempId: string
  name: string
  sort_order: number
}

export interface FormLine {
  tempId: string
  tempGroupId: string
  product_id: string | null
  supplier_id: string | null
  deal_reg_line_id: string | null
  sort_order: number
  description: string
  quantity: number
  buy_price: number
  sell_price: number
  fulfilment_route: 'from_stock' | 'drop_ship'
  is_optional: boolean
  requires_contract: boolean
  notes: string | null
  // UI-only: track original deal reg price for warning
  original_deal_price: number | null
}

export interface FormAttribution {
  tempId: string
  user_id: string
  attribution_type: 'direct' | 'involvement' | 'override'
  split_pct: number
}

export interface QuoteFormState {
  // Header fields
  customer_id: string
  contact_id: string
  opportunity_id: string
  assigned_to: string
  brand_id: string
  quote_type: string
  valid_until: string
  vat_rate: number
  customer_notes: string
  internal_notes: string
  // Children
  groups: FormGroup[]
  lines: FormLine[]
  attributions: FormAttribution[]
  // UI state
  saving: boolean
  error: string | null
}

// --- Lookup types ---

export interface CustomerLookup {
  id: string
  name: string
  customer_type: string | null
}

export interface ContactLookup {
  id: string
  customer_id: string
  first_name: string
  last_name: string
  email: string | null
}

export interface ProductLookup {
  id: string
  sku: string
  name: string
  category_id: string | null
  category_name: string | null
  default_buy_price: number | null
  default_sell_price: number | null
}

export interface SupplierLookup {
  id: string
  name: string
}

export interface UserLookup {
  id: string
  first_name: string
  last_name: string
  initials: string | null
  color: string | null
}

export interface ProductSupplierLookup {
  product_id: string
  supplier_id: string
  standard_cost: number | null
  is_preferred: boolean
}

export interface CategoryLookup {
  id: string
  name: string
}

export interface BrandLookup {
  id: string
  name: string
  logo_path: string | null
  is_default: boolean
  customer_type: string | null
}

// --- Actions ---

export type QuoteAction =
  | { type: 'SET_FIELD'; field: keyof QuoteFormState; value: unknown }
  | { type: 'ADD_GROUP'; name?: string; tempId?: string }
  | { type: 'REMOVE_GROUP'; tempId: string }
  | { type: 'RENAME_GROUP'; tempId: string; name: string }
  | { type: 'REORDER_GROUPS'; groups: FormGroup[] }
  | { type: 'ADD_LINE'; line: FormLine }
  | { type: 'UPDATE_LINE'; tempId: string; updates: Partial<FormLine> }
  | { type: 'REMOVE_LINE'; tempId: string }
  | { type: 'REORDER_LINES'; lines: FormLine[] }
  | { type: 'ADD_ATTRIBUTION' }
  | { type: 'UPDATE_ATTRIBUTION'; tempId: string; updates: Partial<FormAttribution> }
  | { type: 'REMOVE_ATTRIBUTION'; tempId: string }
  | { type: 'LOAD_EXISTING'; state: Partial<QuoteFormState> }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'SET_ERROR'; error: string | null }

// --- Reducer ---

export function quoteFormReducer(state: QuoteFormState, action: QuoteAction): QuoteFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }

    case 'ADD_GROUP': {
      const newGroup: FormGroup = {
        tempId: action.tempId || generateUUID(),
        name: action.name || `Group ${state.groups.length + 1}`,
        sort_order: state.groups.length,
      }
      return { ...state, groups: [...state.groups, newGroup] }
    }

    case 'REMOVE_GROUP': {
      if (state.groups.length <= 1) return state
      const remaining = state.groups.filter((g) => g.tempId !== action.tempId)
      const firstGroup = remaining[0]
      // Move orphaned lines to first remaining group
      const updatedLines = state.lines.map((l) =>
        l.tempGroupId === action.tempId ? { ...l, tempGroupId: firstGroup.tempId } : l
      )
      return { ...state, groups: remaining, lines: updatedLines }
    }

    case 'RENAME_GROUP':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.tempId === action.tempId ? { ...g, name: action.name } : g
        ),
      }

    case 'REORDER_GROUPS':
      return {
        ...state,
        groups: action.groups.map((g, i) => ({ ...g, sort_order: i })),
      }

    case 'ADD_LINE':
      return { ...state, lines: [...state.lines, action.line] }

    case 'UPDATE_LINE':
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.tempId === action.tempId ? { ...l, ...action.updates } : l
        ),
      }

    case 'REMOVE_LINE':
      return {
        ...state,
        lines: state.lines.filter((l) => l.tempId !== action.tempId),
      }

    case 'REORDER_LINES':
      return {
        ...state,
        lines: action.lines.map((l, i) => ({ ...l, sort_order: i })),
      }

    case 'ADD_ATTRIBUTION': {
      const newAttr: FormAttribution = {
        tempId: generateUUID(),
        user_id: '',
        attribution_type: 'direct',
        split_pct: 0,
      }
      return { ...state, attributions: [...state.attributions, newAttr] }
    }

    case 'UPDATE_ATTRIBUTION':
      return {
        ...state,
        attributions: state.attributions.map((a) =>
          a.tempId === action.tempId ? { ...a, ...action.updates } : a
        ),
      }

    case 'REMOVE_ATTRIBUTION':
      return {
        ...state,
        attributions: state.attributions.filter((a) => a.tempId !== action.tempId),
      }

    case 'LOAD_EXISTING':
      return { ...state, ...action.state }

    case 'SET_SAVING':
      return { ...state, saving: action.saving }

    case 'SET_ERROR':
      return { ...state, error: action.error }

    default:
      return state
  }
}

// --- Initial state ---

export function createInitialState(
  currentUserId: string,
  opportunityCustomerId?: string | null,
  opportunityId?: string | null
): QuoteFormState {
  const defaultGroupId = generateUUID()
  return {
    customer_id: opportunityCustomerId || '',
    contact_id: '',
    opportunity_id: opportunityId || '',
    assigned_to: currentUserId,
    brand_id: '',
    quote_type: '',
    valid_until: '',
    vat_rate: 20,
    customer_notes: '',
    internal_notes: '',
    groups: [{ tempId: defaultGroupId, name: 'General', sort_order: 0 }],
    lines: [],
    attributions: [
      {
        tempId: generateUUID(),
        user_id: currentUserId,
        attribution_type: 'direct',
        split_pct: 100,
      },
    ],
    saving: false,
    error: null,
  }
}

// --- Helpers ---

export function loadExistingQuote(
  quote: Record<string, unknown>,
  groups: { id: string; name: string; sort_order: number }[],
  lines: {
    id: string; group_id: string | null; product_id: string | null; supplier_id: string | null;
    deal_reg_line_id: string | null; sort_order: number; description: string; quantity: number;
    buy_price: number; sell_price: number; fulfilment_route: string; is_optional: boolean;
    requires_contract: boolean; notes: string | null
  }[],
  attributions: { id: string; user_id: string; attribution_type: string; split_pct: number }[],
  dealPricing: ActiveDealPricing[]
): Partial<QuoteFormState> {
  // Build group tempId map from real ids
  const groupTempMap = new Map<string, string>()
  const formGroups: FormGroup[] = groups.map((g) => {
    const tempId = generateUUID()
    groupTempMap.set(g.id, tempId)
    return { tempId, name: g.name, sort_order: g.sort_order }
  })

  // If no groups, add a default
  if (formGroups.length === 0) {
    const tempId = generateUUID()
    formGroups.push({ tempId, name: 'General', sort_order: 0 })
  }

  const formLines: FormLine[] = lines.map((l) => {
    // Check if this line has deal reg pricing
    const dealPrice = l.deal_reg_line_id && l.product_id
      ? dealPricing.find((dp) => dp.product_id === l.product_id && dp.customer_id === (quote.customer_id as string))?.deal_cost ?? null
      : null

    return {
      tempId: generateUUID(),
      tempGroupId: l.group_id ? (groupTempMap.get(l.group_id) || formGroups[0].tempId) : formGroups[0].tempId,
      product_id: l.product_id,
      supplier_id: l.supplier_id,
      deal_reg_line_id: l.deal_reg_line_id,
      sort_order: l.sort_order,
      description: l.description,
      quantity: l.quantity,
      buy_price: l.buy_price,
      sell_price: l.sell_price,
      fulfilment_route: l.fulfilment_route as 'from_stock' | 'drop_ship',
      is_optional: l.is_optional,
      requires_contract: l.requires_contract,
      notes: l.notes,
      original_deal_price: dealPrice,
    }
  })

  const formAttrs: FormAttribution[] = attributions.map((a) => ({
    tempId: generateUUID(),
    user_id: a.user_id,
    attribution_type: a.attribution_type as 'direct' | 'involvement' | 'override',
    split_pct: a.split_pct,
  }))

  return {
    customer_id: (quote.customer_id as string) || '',
    contact_id: (quote.contact_id as string) || '',
    opportunity_id: (quote.opportunity_id as string) || '',
    assigned_to: (quote.assigned_to as string) || '',
    brand_id: (quote.brand_id as string) || '',
    quote_type: (quote.quote_type as string) || '',
    valid_until: (quote.valid_until as string) || '',
    vat_rate: (quote.vat_rate as number) ?? 20,
    customer_notes: (quote.customer_notes as string) || '',
    internal_notes: (quote.internal_notes as string) || '',
    groups: formGroups,
    lines: formLines,
    attributions: formAttrs,
  }
}
