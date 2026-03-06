'use client'

import { DEFAULT_MARGIN_GREEN, DEFAULT_MARGIN_AMBER, getMarginColorFromPct } from '@/lib/margin'

interface MarginIndicatorProps {
  buyPrice: number | null
  sellPrice: number | null
  showAmount?: boolean
  greenThreshold?: number
  amberThreshold?: number
}

export function MarginIndicator({
  buyPrice,
  sellPrice,
  showAmount = false,
  greenThreshold = DEFAULT_MARGIN_GREEN,
  amberThreshold = DEFAULT_MARGIN_AMBER,
}: MarginIndicatorProps) {
  if (buyPrice == null || sellPrice == null || sellPrice <= 0) {
    return <span className="text-slate-400">{'\u2014'}</span>
  }

  const marginPct = ((sellPrice - buyPrice) / sellPrice) * 100
  const marginAmt = sellPrice - buyPrice
  const color = getMarginColorFromPct(marginPct, greenThreshold, amberThreshold)

  return (
    <span className={`font-medium ${color}`}>
      {showAmount && `£${marginAmt.toFixed(2)} `}
      ({marginPct.toFixed(1)}%)
    </span>
  )
}

export { getMarginColor, getMarginColorFromPct, getMarginAccent } from '@/lib/margin'
