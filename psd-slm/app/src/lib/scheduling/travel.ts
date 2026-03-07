// PORTABLE: uses OSRM + Nominatim - no API key required
// Both services are free, keyless, and self-hostable.

export interface TravelEstimate {
  durationMinutes: number
  distanceKm: number
  originAddress: string
  destinationAddress: string
  routeFound: boolean
}

interface LatLng {
  lat: number
  lng: number
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const OSRM_BASE = 'https://router.project-osrm.org'
const USER_AGENT = 'Engage-MSP/1.0'

/**
 * Extract a UK postcode from an address string.
 * UK postcodes are the most reliable geocoding input.
 */
function extractPostcode(address: string): string | null {
  const match = address.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)
  return match ? match[0].trim() : null
}

/**
 * Geocode a UK address string or postcode to lat/lng via Nominatim.
 * Server-side only. Tries postcode first (most reliable for UK), falls back to full address.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!address || !address.trim()) return null

  // Try postcode first — much more reliable for UK geocoding
  const postcode = extractPostcode(address)
  const queries = postcode
    ? [`${postcode}, UK`, address.trim()]
    : [address.trim(), `${address.trim()}, UK`]

  for (const query of queries) {
    try {
      const q = encodeURIComponent(query)
      const url = `${NOMINATIM_BASE}/search?q=${q}&format=json&limit=1&countrycodes=gb`
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        console.warn('[travel] Nominatim returned', res.status, 'for query:', query)
        continue
      }

      const data = await res.json()
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        }
      }
    } catch (err) {
      console.warn('[travel] Geocode failed for:', query, err)
    }

    // Rate limit between attempts
    await new Promise(resolve => setTimeout(resolve, 1100))
  }

  console.warn('[travel] All geocode attempts failed for:', address)
  return null
}

/**
 * Get driving duration between two lat/lng points via OSRM.
 * Server-side only.
 */
export async function getDrivingTime(
  origin: LatLng,
  destination: LatLng
): Promise<{ durationMinutes: number; distanceKm: number } | null> {
  try {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
    const res = await fetch(
      `${OSRM_BASE}/route/v1/driving/${coords}?overview=false`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!res.ok) return null

    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null

    const route = data.routes[0]
    return {
      durationMinutes: Math.ceil(route.duration / 60),
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    }
  } catch {
    return null
  }
}

/**
 * High-level helper: estimate travel time between two address strings.
 * Server-side only. Degrades gracefully on failure.
 */
export async function estimateTravelTime(
  fromAddress: string,
  toAddress: string
): Promise<TravelEstimate> {
  const result: TravelEstimate = {
    durationMinutes: 0,
    distanceKm: 0,
    originAddress: fromAddress,
    destinationAddress: toAddress,
    routeFound: false,
  }

  const origin = await geocodeAddress(fromAddress)
  if (!origin) return result

  // Nominatim rate limit: max 1 req/sec
  await new Promise(resolve => setTimeout(resolve, 1100))

  const destination = await geocodeAddress(toAddress)
  if (!destination) return result

  const driving = await getDrivingTime(origin, destination)
  if (!driving) return result

  result.durationMinutes = driving.durationMinutes
  result.distanceKm = driving.distanceKm
  result.routeFound = true

  return result
}

// Cache for geocode results within a single request lifecycle
const geocodeCache = new Map<string, LatLng | null>()

/**
 * Geocode with in-memory cache to avoid redundant Nominatim calls.
 * Respects Nominatim 1 req/sec rate limit.
 */
export async function geocodeAddressCached(address: string): Promise<LatLng | null> {
  const key = address.trim().toLowerCase()
  if (geocodeCache.has(key)) return geocodeCache.get(key)!

  const result = await geocodeAddress(address)
  geocodeCache.set(key, result)
  return result
}

/**
 * Clear the geocode cache (call at the start of batch operations).
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear()
}
