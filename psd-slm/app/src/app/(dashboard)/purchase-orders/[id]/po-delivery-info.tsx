'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, DELIVERY_DESTINATION_CONFIG } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { updatePoField, updatePoDeliveryCost } from '../actions'

interface PoDeliveryInfoProps {
  po: {
    id: string
    status: string
    delivery_destination: string
    delivery_address_line1: string | null
    delivery_address_line2: string | null
    delivery_city: string | null
    delivery_postcode: string | null
    delivery_cost: number
    delivery_instructions: string | null
    supplier_ref: string | null
    expected_delivery_date: string | null
  }
}

export function PoDeliveryInfo({ po }: PoDeliveryInfoProps) {
  const router = useRouter()
  const isDraft = po.status === 'draft'
  const canEditFields = ['draft', 'sent', 'acknowledged'].includes(po.status)

  const [deliveryCost, setDeliveryCost] = useState(po.delivery_cost || 0)
  const [supplierRef, setSupplierRef] = useState(po.supplier_ref || '')
  const [expectedDate, setExpectedDate] = useState(po.expected_delivery_date || '')
  const [instructions, setInstructions] = useState(po.delivery_instructions || '')
  const [saving, setSaving] = useState<string | null>(null)

  const destCfg = DELIVERY_DESTINATION_CONFIG[po.delivery_destination]
  const address = [po.delivery_address_line1, po.delivery_address_line2, po.delivery_city, po.delivery_postcode]
    .filter(Boolean)
    .join(', ')

  const handleSaveField = async (field: string, value: string | null) => {
    setSaving(field)
    await updatePoField(po.id, field, value || null)
    setSaving(null)
    router.refresh()
  }

  const handleSaveDeliveryCost = async () => {
    setSaving('delivery_cost')
    await updatePoDeliveryCost(po.id, deliveryCost)
    setSaving(null)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Delivery details */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-[15px] font-semibold mb-4">Delivery</h3>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Destination</div>
            {destCfg ? <Badge label={destCfg.label} color={destCfg.color} bg={destCfg.bg} /> : po.delivery_destination}
          </div>
          {address && (
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Address</div>
              <div className="text-slate-700">{address}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Delivery Cost</div>
            {isDraft ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(parseFloat(e.target.value) || 0)}
                  onBlur={handleSaveDeliveryCost}
                  className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400"
                />
                {saving === 'delivery_cost' && <span className="text-xs text-slate-400">Saving...</span>}
              </div>
            ) : (
              <div className="text-slate-700">{formatCurrency(po.delivery_cost || 0)}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Instructions</div>
            {canEditFields ? (
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                onBlur={() => handleSaveField('delivery_instructions', instructions)}
                rows={2}
                placeholder="Delivery instructions..."
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400"
              />
            ) : (
              <div className="text-slate-700">{po.delivery_instructions || '\u2014'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Supplier details */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-[15px] font-semibold mb-4">Supplier Details</h3>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Supplier Reference</div>
            {canEditFields ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={supplierRef}
                  onChange={(e) => setSupplierRef(e.target.value)}
                  onBlur={() => handleSaveField('supplier_ref', supplierRef)}
                  placeholder="e.g. TD-ORD-123456"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400"
                />
                {saving === 'supplier_ref' && <span className="text-xs text-slate-400">Saving...</span>}
              </div>
            ) : (
              <div className="text-slate-700">{po.supplier_ref || '\u2014'}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Expected Delivery</div>
            {canEditFields ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  onBlur={() => handleSaveField('expected_delivery_date', expectedDate)}
                  className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400"
                />
                {saving === 'expected_delivery_date' && <span className="text-xs text-slate-400">Saving...</span>}
              </div>
            ) : (
              <div className="text-slate-700">{po.expected_delivery_date ? formatDate(po.expected_delivery_date) : '\u2014'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
