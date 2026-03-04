'use client'

import { useCallback } from 'react'
import type { GpsCoords } from '@/types/database'

export type GpsError = 'permission_denied' | 'position_unavailable' | 'timeout' | 'not_supported'

export interface GpsCaptureResult {
  coords: GpsCoords | null
  error: GpsError | null
}

/**
 * Hook wrapping the browser Geolocation API.
 * Returns a `capturePosition` function that resolves to coords or null.
 * GPS failure never blocks the calling action.
 */
export function useGeoCapture() {
  const capturePosition = useCallback((): Promise<GpsCoords | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
          })
        },
        (err) => {
          console.warn('[GPS]', err.code, err.message)
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      )
    })
  }, [])

  /** Like capturePosition but returns the error reason too */
  const captureWithReason = useCallback((): Promise<GpsCaptureResult> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve({ coords: null, error: 'not_supported' })
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            coords: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? null,
            },
            error: null,
          })
        },
        (err) => {
          const errorMap: Record<number, GpsError> = {
            1: 'permission_denied',
            2: 'position_unavailable',
            3: 'timeout',
          }
          resolve({ coords: null, error: errorMap[err.code] || 'position_unavailable' })
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      )
    })
  }, [])

  return { capturePosition, captureWithReason }
}
