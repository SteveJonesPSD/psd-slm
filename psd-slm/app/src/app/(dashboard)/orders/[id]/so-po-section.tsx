import Link from 'next/link'
import { Badge, PO_STATUS_CONFIG, DELIVERY_DESTINATION_CONFIG } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

interface PoRef {
  id: string
  po_number: string
  status: string
  delivery_destination: string
  delivery_cost: number
  suppliers: { id: string; name: string } | null
  purchase_order_lines: { id: string; sales_order_line_id: string; quantity: number; unit_cost: number; status: string }[]
}

interface SoPoSectionProps {
  purchaseOrders: PoRef[]
}

export function SoPoSection({ purchaseOrders }: SoPoSectionProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-6">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-[15px] font-semibold">Purchase Orders</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">PO Number</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supplier</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Delivery To</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lines</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.map((po) => {
              const statusCfg = PO_STATUS_CONFIG[po.status]
              const destCfg = DELIVERY_DESTINATION_CONFIG[po.delivery_destination]
              const goodsTotal = po.purchase_order_lines.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)
              const total = goodsTotal + (po.delivery_cost || 0)
              return (
                <tr key={po.id} className="border-t border-slate-100">
                  <td className="px-5 py-2.5">
                    <Link href={`/purchase-orders/${po.id}`} className="text-blue-600 font-semibold hover:underline no-underline">
                      {po.po_number}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">{po.suppliers?.name || '\u2014'}</td>
                  <td className="px-5 py-2.5">
                    {destCfg && <Badge label={destCfg.label} color={destCfg.color} bg={destCfg.bg} />}
                  </td>
                  <td className="px-5 py-2.5">
                    {statusCfg && <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />}
                  </td>
                  <td className="px-5 py-2.5 text-center">{po.purchase_order_lines.length}</td>
                  <td className="px-5 py-2.5 text-right font-medium">{formatCurrency(total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
