'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { FormGroup, FormLine, QuoteAction } from './quote-builder-types'

interface GroupHeaderProps {
  group: FormGroup
  lines: FormLine[]
  groupCount: number
  dispatch: React.Dispatch<QuoteAction>
  onAddProduct: (groupTempId: string) => void
}

export function GroupHeader({ group, lines, groupCount, dispatch, onAddProduct }: GroupHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(group.name)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.tempId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const subtotal = lines
    .filter((l) => !l.is_optional)
    .reduce((sum, l) => sum + l.quantity * l.sell_price, 0)

  const handleSaveName = () => {
    if (editName.trim()) {
      dispatch({ type: 'RENAME_GROUP', tempId: group.tempId, name: editName.trim() })
    } else {
      setEditName(group.name)
    }
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 mb-1"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-grab text-slate-300 hover:text-slate-500"
          {...attributes}
          {...listeners}
        >
          &#x2630;
        </button>

        {editing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName()
              if (e.key === 'Escape') {
                setEditName(group.name)
                setEditing(false)
              }
            }}
            className="rounded border border-slate-300 px-2 py-1 text-sm font-semibold outline-none focus:border-slate-400"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            {group.name}
          </button>
        )}

        <span className="text-xs text-slate-400">
          {lines.length} {lines.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">{formatCurrency(subtotal)}</span>

        <Button
          size="sm"
          variant="default"
          onClick={() => onAddProduct(group.tempId)}
        >
          + Product
        </Button>

        {groupCount > 1 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_GROUP', tempId: group.tempId })}
            className="text-slate-400 hover:text-red-500 text-sm"
            title="Delete group"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
