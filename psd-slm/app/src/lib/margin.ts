/**
 * Shared margin utilities — safe to use in both server and client components.
 */

export function getMarginColor(buyPrice: number | null, sellPrice: number | null): string {
  if (buyPrice == null || sellPrice == null || sellPrice <= 0) return ''
  const pct = ((sellPrice - buyPrice) / sellPrice) * 100
  if (pct >= 30) return 'text-emerald-600'
  if (pct >= 15) return 'text-amber-600'
  return 'text-red-600'
}
