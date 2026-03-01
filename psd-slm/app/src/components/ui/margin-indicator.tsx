'use client'

interface MarginIndicatorProps {
  buyPrice: number | null
  sellPrice: number | null
  showAmount?: boolean
}

export function MarginIndicator({ buyPrice, sellPrice, showAmount = false }: MarginIndicatorProps) {
  if (buyPrice == null || sellPrice == null || sellPrice <= 0) {
    return <span className="text-slate-400">{'\u2014'}</span>
  }

  const marginPct = ((sellPrice - buyPrice) / sellPrice) * 100
  const marginAmt = sellPrice - buyPrice

  const color =
    marginPct >= 30 ? 'text-emerald-600' :
    marginPct >= 15 ? 'text-amber-600' :
    'text-red-600'

  return (
    <span className={`font-medium ${color}`}>
      {showAmount && `£${marginAmt.toFixed(2)} `}
      ({marginPct.toFixed(1)}%)
    </span>
  )
}

export { getMarginColor } from '@/lib/margin'
