/**
 * Shared margin utilities — safe to use in both server and client components.
 * Thresholds are configurable via org_settings (category: general,
 * keys: margin_threshold_green, margin_threshold_amber).
 */

export const DEFAULT_MARGIN_GREEN = 30
export const DEFAULT_MARGIN_AMBER = 15

export function getMarginColor(
  buyPrice: number | null,
  sellPrice: number | null,
  greenThreshold = DEFAULT_MARGIN_GREEN,
  amberThreshold = DEFAULT_MARGIN_AMBER,
): string {
  if (buyPrice == null || sellPrice == null || sellPrice <= 0) return ''
  const pct = ((sellPrice - buyPrice) / sellPrice) * 100
  if (pct >= greenThreshold) return 'text-emerald-600'
  if (pct >= amberThreshold) return 'text-amber-600'
  return 'text-red-600'
}

export function getMarginColorFromPct(
  pct: number,
  greenThreshold = DEFAULT_MARGIN_GREEN,
  amberThreshold = DEFAULT_MARGIN_AMBER,
): string {
  if (pct >= greenThreshold) return 'text-emerald-600'
  if (pct >= amberThreshold) return 'text-amber-600'
  return 'text-red-600'
}

export function getMarginAccent(
  pct: number,
  greenThreshold = DEFAULT_MARGIN_GREEN,
  amberThreshold = DEFAULT_MARGIN_AMBER,
): string {
  if (pct >= greenThreshold) return '#059669'
  if (pct >= amberThreshold) return '#d97706'
  return '#dc2626'
}
