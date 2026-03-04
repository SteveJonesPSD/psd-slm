'use client'

import { useState, useCallback, useEffect } from 'react'
import { updateInboundPO } from '../actions'
import type { Json } from '@/types/database'

interface ExtractedFields {
  customer_po_number: string | null
  customer_name: string | null
  contact_name: string | null
  po_date: string | null
  total_value: number | null
  delivery_address: string | null
  special_instructions: string | null
  our_reference: string | null
}

interface ExtractedDataFormProps {
  inboundPoId: string
  fields: ExtractedFields
  extractionConfidence: string | null
  extractedData: Json | null
  onSaved: () => void
}

type FieldKey = keyof ExtractedFields

const FIELD_LABELS: Record<FieldKey, string> = {
  customer_po_number: 'PO Number',
  customer_name: 'Customer Name',
  contact_name: 'Contact Name',
  po_date: 'PO Date',
  total_value: 'Total Value',
  delivery_address: 'Delivery Address',
  special_instructions: 'Special Instructions',
  our_reference: 'Our Reference',
}

export function ExtractedDataForm({
  inboundPoId,
  fields,
  extractionConfidence,
  extractedData,
  onSaved,
}: ExtractedDataFormProps) {
  const [formData, setFormData] = useState<ExtractedFields>({ ...fields })
  const [editedFields, setEditedFields] = useState<Set<FieldKey>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync form data when props change (e.g. after polling picks up pipeline results)
  // Only update fields the user hasn't manually edited
  useEffect(() => {
    setFormData((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(fields) as FieldKey[]) {
        if (!editedFields.has(key)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(next as any)[key] = fields[key]
        }
      }
      return next
    })
  }, [fields, editedFields])

  // Original AI values for reset
  const originalData = extractedData as Record<string, unknown> | null

  const handleChange = useCallback((key: FieldKey, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: key === 'total_value' ? (value ? parseFloat(value) : null) : (value || null),
    }))
    setEditedFields((prev) => new Set(prev).add(key))
  }, [])

  const handleReset = useCallback((key: FieldKey) => {
    if (!originalData) return
    const originalValue = originalData[key]
    setFormData((prev) => ({
      ...prev,
      [key]: originalValue as ExtractedFields[FieldKey] ?? null,
    }))
    setEditedFields((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [originalData])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const result = await updateInboundPO(inboundPoId, formData)
    if (result.error) {
      setError(result.error)
    } else {
      setEditedFields(new Set())
      onSaved()
    }
    setSaving(false)
  }

  const confidenceColors: Record<string, string> = {
    high: 'text-green-700 bg-green-50 border-green-200',
    medium: 'text-amber-700 bg-amber-50 border-amber-200',
    low: 'text-red-700 bg-red-50 border-red-200',
    failed: 'text-red-700 bg-red-50 border-red-200',
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Extracted Data</h3>
          {extractionConfidence && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${confidenceColors[extractionConfidence] || ''}`}>
              {extractionConfidence} confidence
            </span>
          )}
        </div>
        {editedFields.size > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => {
          const isEdited = editedFields.has(key)
          const isAI = extractedData !== null && !isEdited && formData[key] !== null

          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-medium text-slate-500">
                  {FIELD_LABELS[key]}
                </label>
                {isAI && (
                  <span className="text-xs text-indigo-500 flex items-center gap-0.5" title="AI-extracted value">
                    ✨ AI
                  </span>
                )}
                {isEdited && (
                  <span className="text-xs text-amber-500 flex items-center gap-0.5">
                    Edited
                    {originalData && (
                      <button
                        onClick={() => handleReset(key)}
                        className="ml-1 text-amber-600 hover:text-amber-700 underline"
                      >
                        Reset
                      </button>
                    )}
                  </span>
                )}
              </div>
              {key === 'delivery_address' || key === 'special_instructions' ? (
                <textarea
                  value={formData[key] as string || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : key === 'total_value' ? (
                <input
                  type="number"
                  step="0.01"
                  value={formData[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : key === 'po_date' ? (
                <input
                  type="date"
                  value={formData[key] as string || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <input
                  type="text"
                  value={formData[key] as string || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="border-t border-gray-200 px-4 py-2">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
