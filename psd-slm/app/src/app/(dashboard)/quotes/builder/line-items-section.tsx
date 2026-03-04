'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { generateUUID } from '@/lib/utils'
import { GroupHeader } from './group-header'
import { LineItemRow } from './line-item-row'
import { ProductPickerModal } from './product-picker-modal'
import type {
  QuoteFormState,
  QuoteAction,
  ProductLookup,
  CategoryLookup,
  SupplierLookup,
  ProductSupplierLookup,
  FormLine,
} from './quote-builder-types'
import type { ActiveDealPricing } from '@/types/database'

interface LineItemsSectionProps {
  state: QuoteFormState
  dispatch: React.Dispatch<QuoteAction>
  products: ProductLookup[]
  categories: CategoryLookup[]
  suppliers: SupplierLookup[]
  productSuppliers: ProductSupplierLookup[]
  dealPricing: ActiveDealPricing[]
  onRefreshProducts?: () => void
}

export function LineItemsSection({
  state,
  dispatch,
  products,
  categories,
  suppliers,
  productSuppliers,
  dealPricing,
  onRefreshProducts,
}: LineItemsSectionProps) {
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Determine if this is a group drag or a line drag
    const isGroupDrag = state.groups.some((g) => g.tempId === activeId)
    const isGroupTarget = state.groups.some((g) => g.tempId === overId)

    if (isGroupDrag && isGroupTarget) {
      // Group reorder
      const oldIndex = state.groups.findIndex((g) => g.tempId === activeId)
      const newIndex = state.groups.findIndex((g) => g.tempId === overId)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...state.groups]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      dispatch({ type: 'REORDER_GROUPS', groups: reordered })
    } else if (!isGroupDrag && !isGroupTarget) {
      // Line reorder (may be cross-group)
      const oldIndex = state.lines.findIndex((l) => l.tempId === activeId)
      const newIndex = state.lines.findIndex((l) => l.tempId === overId)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...state.lines]
      const [moved] = reordered.splice(oldIndex, 1)
      // Update the group if moved to a different group
      const targetLine = state.lines[newIndex]
      if (targetLine) {
        moved.tempGroupId = targetLine.tempGroupId
      }
      reordered.splice(newIndex, 0, moved)
      dispatch({ type: 'REORDER_LINES', lines: reordered })
    }
    // Ignore cross-type drags (group onto line or vice versa)
  }

  const handleAddProduct = (groupTempId: string) => {
    setPickerGroupId(groupTempId)
  }

  const handleProductSelected = (line: FormLine) => {
    dispatch({ type: 'ADD_LINE', line })
  }

  const handleAddManualLine = (groupTempId: string) => {
    const line: FormLine = {
      tempId: generateUUID(),
      tempGroupId: groupTempId,
      product_id: null,
      supplier_id: null,
      deal_reg_line_id: null,
      sort_order: state.lines.filter((l) => l.tempGroupId === groupTempId).length,
      description: '',
      quantity: 1,
      buy_price: 0,
      sell_price: 0,
      fulfilment_route: 'from_stock',
      is_optional: false,
      requires_contract: false,
      notes: null,
      original_deal_price: null,
    }
    dispatch({ type: 'ADD_LINE', line })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-4">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="text-[15px] font-semibold text-slate-900">Line Items</h3>
        <Button
          size="sm"
          variant="default"
          onClick={() => dispatch({ type: 'ADD_GROUP' })}
        >
          + Add Group
        </Button>
      </div>

      <div className="border-t border-gray-100 px-5 py-4">
        {/* Single DndContext for both groups and lines — enables cross-group line dragging */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={state.groups.map((g) => g.tempId)}
            strategy={verticalListSortingStrategy}
          >
            {state.groups.map((group) => {
              const groupLines = state.lines
                .filter((l) => l.tempGroupId === group.tempId)
                .sort((a, b) => a.sort_order - b.sort_order)

              return (
                <div key={group.tempId} className="mb-4">
                  <GroupHeader
                    group={group}
                    lines={groupLines}
                    groupCount={state.groups.length}
                    dispatch={dispatch}
                    onAddProduct={handleAddProduct}
                  />

                  {/* Lines table for this group */}
                  {groupLines.length > 0 && (
                    <div className="overflow-x-auto ml-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="px-2 py-1.5 w-8" />
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Description</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-28">Route</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-36">Supplier</th>
                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-20">Qty</th>
                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-28">Buy</th>
                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-28">Sell</th>
                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-24">Margin</th>
                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-16">%</th>
                            <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-24">Total</th>
                            <th className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-8" title="Contract Required">C</th>
                            <th className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-8" title="Optional">Opt</th>
                            <th className="px-2 py-1.5 w-8" />
                          </tr>
                        </thead>
                        <SortableContext
                          items={groupLines.map((l) => l.tempId)}
                          strategy={verticalListSortingStrategy}
                        >
                          <tbody>
                            {groupLines.map((line) => (
                              <LineItemRow
                                key={line.tempId}
                                line={line}
                                dispatch={dispatch}
                                suppliers={suppliers}
                                products={products}
                              />
                            ))}
                          </tbody>
                        </SortableContext>
                      </table>

                      <button
                        type="button"
                        onClick={() => handleAddManualLine(group.tempId)}
                        className="mt-1 ml-8 text-xs text-slate-400 hover:text-slate-600"
                      >
                        + Add blank line
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </SortableContext>
        </DndContext>
      </div>

      {/* Product Picker Modal */}
      {pickerGroupId && (
        <ProductPickerModal
          onClose={() => setPickerGroupId(null)}
          onSelect={handleProductSelected}
          products={products}
          categories={categories}
          productSuppliers={productSuppliers}
          dealPricing={dealPricing}
          customerId={state.customer_id}
          targetGroupId={pickerGroupId}
          currentLineCount={state.lines.filter((l) => l.tempGroupId === pickerGroupId).length}
          onRefresh={onRefreshProducts}
        />
      )}
    </div>
  )
}
