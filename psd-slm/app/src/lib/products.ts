/**
 * Shared product utilities — safe to use in both server and client components.
 */

export function resolveSerialisedStatus(
  productIsSerialised: boolean | null,
  categoryRequiresSerial: boolean
): boolean {
  if (productIsSerialised === true) return true
  if (productIsSerialised === false) return false
  return categoryRequiresSerial
}
