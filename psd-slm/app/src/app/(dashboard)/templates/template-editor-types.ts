import type { FormGroup, FormLine } from '../quotes/builder/quote-builder-types'

// Re-export for convenience
export type { FormGroup, FormLine }

// Template categories for UI filtering
export const TEMPLATE_CATEGORIES = [
  'access_control',
  'environmental',
  'networking',
  'cabling',
  'general',
] as const

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number]

// --- Form state ---

export interface TemplateFormState {
  name: string
  description: string
  category: string
  default_quote_type: string
  is_active: boolean
  // Children — reuse quote builder's FormGroup and FormLine
  groups: FormGroup[]
  lines: FormLine[]
  // UI state
  saving: boolean
  error: string | null
}

// --- Actions ---

export type TemplateAction =
  | { type: 'SET_FIELD'; field: keyof TemplateFormState; value: unknown }
  | { type: 'ADD_GROUP'; name?: string }
  | { type: 'REMOVE_GROUP'; tempId: string }
  | { type: 'RENAME_GROUP'; tempId: string; name: string }
  | { type: 'REORDER_GROUPS'; groups: FormGroup[] }
  | { type: 'ADD_LINE'; line: FormLine }
  | { type: 'UPDATE_LINE'; tempId: string; updates: Partial<FormLine> }
  | { type: 'REMOVE_LINE'; tempId: string }
  | { type: 'REORDER_LINES'; lines: FormLine[] }
  | { type: 'LOAD_EXISTING'; state: Partial<TemplateFormState> }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'SET_ERROR'; error: string | null }

// --- Reducer ---

export function templateFormReducer(state: TemplateFormState, action: TemplateAction): TemplateFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }

    case 'ADD_GROUP': {
      const newGroup: FormGroup = {
        tempId: crypto.randomUUID(),
        name: action.name || `Group ${state.groups.length + 1}`,
        sort_order: state.groups.length,
      }
      return { ...state, groups: [...state.groups, newGroup] }
    }

    case 'REMOVE_GROUP': {
      if (state.groups.length <= 1) return state
      const remaining = state.groups.filter((g) => g.tempId !== action.tempId)
      const firstGroup = remaining[0]
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

export function createInitialTemplateState(): TemplateFormState {
  const defaultGroupId = crypto.randomUUID()
  return {
    name: '',
    description: '',
    category: '',
    default_quote_type: '',
    is_active: true,
    groups: [{ tempId: defaultGroupId, name: 'General', sort_order: 0 }],
    lines: [],
    saving: false,
    error: null,
  }
}

// --- Load existing template ---

export function loadExistingTemplate(
  template: { name: string; description: string | null; category: string | null; default_quote_type: string | null; is_active: boolean },
  groups: { id: string; name: string; sort_order: number }[],
  lines: {
    id: string; group_id: string | null; product_id: string | null; supplier_id: string | null;
    sort_order: number; description: string; quantity: number;
    default_buy_price: number; default_sell_price: number;
    fulfilment_route: string; is_optional: boolean; requires_contract: boolean; notes: string | null
  }[]
): Partial<TemplateFormState> {
  const groupTempMap = new Map<string, string>()
  const formGroups: FormGroup[] = groups.map((g) => {
    const tempId = crypto.randomUUID()
    groupTempMap.set(g.id, tempId)
    return { tempId, name: g.name, sort_order: g.sort_order }
  })

  if (formGroups.length === 0) {
    const tempId = crypto.randomUUID()
    formGroups.push({ tempId, name: 'General', sort_order: 0 })
  }

  const formLines: FormLine[] = lines.map((l) => ({
    tempId: crypto.randomUUID(),
    tempGroupId: l.group_id ? (groupTempMap.get(l.group_id) || formGroups[0].tempId) : formGroups[0].tempId,
    product_id: l.product_id,
    supplier_id: l.supplier_id,
    deal_reg_line_id: null,
    sort_order: l.sort_order,
    description: l.description,
    quantity: l.quantity,
    buy_price: l.default_buy_price,
    sell_price: l.default_sell_price,
    fulfilment_route: l.fulfilment_route as 'from_stock' | 'drop_ship',
    is_optional: l.is_optional,
    requires_contract: l.requires_contract,
    notes: l.notes,
    original_deal_price: null,
  }))

  return {
    name: template.name,
    description: template.description || '',
    category: template.category || '',
    default_quote_type: template.default_quote_type || '',
    is_active: template.is_active,
    groups: formGroups,
    lines: formLines,
  }
}
