'use client'

import { Badge } from './badge'
import { resolveSerialisedStatus } from '@/lib/products'

export { resolveSerialisedStatus }

interface SerialisedBadgeProps {
  productIsSerialised: boolean | null
  categoryRequiresSerial: boolean
}

export function SerialisedBadge({ productIsSerialised, categoryRequiresSerial }: SerialisedBadgeProps) {
  const resolved = resolveSerialisedStatus(productIsSerialised, categoryRequiresSerial)
  if (!resolved) return null
  return <Badge label="Serialised" color="#7c3aed" bg="#f5f3ff" />
}
