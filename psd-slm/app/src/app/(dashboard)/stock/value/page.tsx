import { requirePermission } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { formatCurrency } from '@/lib/utils'
import { getStockValueReport } from '../actions'

export default async function StockValuePage() {
  await requirePermission('stock', 'view')
  const stockData = await getStockValueReport()

  // Group by category
  const categories = new Map<string, typeof stockData>()
  for (const item of stockData) {
    const cat = item.category_name || 'Uncategorised'
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(item)
  }

  const totalValue = stockData.reduce((sum, s) => sum + s.quantity_on_hand * (s.default_buy_price || 0), 0)
  const totalSkus = stockData.length
  const highestValue = stockData.reduce((max, s) => {
    const v = s.quantity_on_hand * (s.default_buy_price || 0)
    return v > max.value ? { name: s.product_name, value: v } : max
  }, { name: '', value: 0 })
  const avgValue = totalSkus > 0 ? totalValue / totalSkus : 0

  return (
    <div>
      <PageHeader
        title="Stock Value"
        subtitle="Current stock valuation by category"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Value" value={formatCurrency(totalValue)} accent="#6366f1" />
        <StatCard label="Total SKUs" value={totalSkus} accent="#1e293b" />
        <StatCard label="Highest Value" value={formatCurrency(highestValue.value)} sub={highestValue.name} accent="#d97706" />
        <StatCard label="Avg Value/SKU" value={formatCurrency(avgValue)} accent="#059669" />
      </div>

      {/* Category groups */}
      {[...categories.entries()].map(([catName, items]) => {
        const catTotal = items.reduce((sum, s) => sum + s.quantity_on_hand * (s.default_buy_price || 0), 0)

        return (
          <div key={catName} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">{catName}</h3>
              <span className="text-sm font-semibold text-slate-500">{formatCurrency(catTotal)}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium uppercase text-slate-400">
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-right">On Hand</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Line Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-sm font-mono text-slate-400 whitespace-nowrap">{item.sku}</td>
                      <td className="px-4 py-2.5 text-sm">{item.product_name}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{item.quantity_on_hand}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(item.default_buy_price || 0)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">
                        {formatCurrency(item.quantity_on_hand * (item.default_buy_price || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Grand total */}
      {categories.size > 0 && (
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-900">Grand Total</span>
          <span className="text-lg font-bold text-indigo-900">{formatCurrency(totalValue)}</span>
        </div>
      )}
    </div>
  )
}
