/**
 * Shared product utilities — safe to use in both server and client components.
 */

export function resolveSerialisedStatus(
  productIsSerialised: boolean | null,
  categoryRequiresSerial: boolean,
  productType?: 'goods' | 'service'
): boolean {
  // Services are never serialised regardless of category or product override
  if (productType === 'service') return false

  if (productIsSerialised === true) return true
  if (productIsSerialised === false) return false
  return categoryRequiresSerial
}
