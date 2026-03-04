'use client'

interface AutogrumpBadgeProps {
  toneScore: number | null
  toneTrend: string | null
  toneSummary: string | null
  size?: 'sm' | 'md'
}

export function AutogrumpBadge({ toneScore, toneTrend, toneSummary, size = 'sm' }: AutogrumpBadgeProps) {
  if (!toneScore || toneScore <= 2) return null

  const tooltip = toneSummary
    ? toneTrend === 'escalating'
      ? `${toneSummary} (escalating)`
      : toneSummary
    : `Frustration: ${toneScore}/5`

  if (toneScore === 3) {
    if (toneTrend === 'escalating') {
      return (
        <span title={tooltip} className="inline-flex items-center">
          <span className={`${size === 'sm' ? 'text-sm' : 'text-base'} leading-none`} role="img" aria-label="Mildly frustrated, escalating">
            😐
          </span>
        </span>
      )
    }
    return (
      <span title={tooltip} className="inline-flex items-center">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
      </span>
    )
  }

  if (toneScore === 4) {
    return (
      <span title={tooltip} className="inline-flex items-center">
        <span className={`${size === 'sm' ? 'text-sm' : 'text-base'} leading-none`} role="img" aria-label="Frustrated">
          😠
        </span>
      </span>
    )
  }

  // Score 5
  return (
    <span title={tooltip} className="inline-flex items-center">
      <span className={`${size === 'sm' ? 'text-sm' : 'text-base'} leading-none animate-pulse`} role="img" aria-label="Angry">
        😡
      </span>
    </span>
  )
}

// Inline banner for ticket detail page
export function AutogrumpBanner({ toneScore, toneTrend, toneSummary }: AutogrumpBadgeProps) {
  if (!toneScore || toneScore <= 2) return null

  const isRed = toneScore >= 4
  const bg = isRed ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
  const textColor = isRed ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
  const subColor = isRed ? 'text-red-500 dark:text-red-500' : 'text-amber-500 dark:text-amber-500'

  const scoreLabels: Record<number, string> = {
    3: 'Mildly Frustrated',
    4: 'Frustrated',
    5: 'Angry',
  }

  const trendLabels: Record<string, string> = {
    escalating: 'Escalating',
    stable: 'Stable',
    improving: 'Improving',
    new: 'New',
  }

  return (
    <div className={`rounded-lg border ${bg} px-3 py-2 flex items-center gap-2`}>
      <AutogrumpBadge toneScore={toneScore} toneTrend={toneTrend} toneSummary={toneSummary} size="md" />
      <div>
        <span className={`text-xs font-semibold ${textColor}`}>
          {scoreLabels[toneScore] || 'Frustrated'}
          {toneTrend && toneTrend !== 'new' && (
            <span className={`ml-1 font-normal ${subColor}`}>
              · {trendLabels[toneTrend] || toneTrend}
            </span>
          )}
        </span>
        {toneSummary && (
          <span className={`ml-1.5 text-xs ${subColor}`}>
            &mdash; &ldquo;{toneSummary}&rdquo;
          </span>
        )}
      </div>
    </div>
  )
}
