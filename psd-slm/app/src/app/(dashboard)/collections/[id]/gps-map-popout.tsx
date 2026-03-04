'use client'

import { useRef, useEffect, useState } from 'react'

interface GpsMapPopoutProps {
  latitude: number
  longitude: number
  accuracy: number | null
  engineerInitials: string | null
}

export function GpsMapPopout({ latitude, longitude, accuracy, engineerInitials }: GpsMapPopoutProps) {
  const [showMap, setShowMap] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMap = useRef<any>(null)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!showMap || !mapRef.current) return

    let cancelled = false

    async function initMap() {
      const L = (await import('leaflet')).default
      // @ts-expect-error — CSS import handled by bundler at runtime
      await import('leaflet/dist/leaflet.css')

      if (cancelled || !mapRef.current) return

      if (leafletMap.current) {
        leafletMap.current.remove()
        leafletMap.current = null
      }

      const map = L.map(mapRef.current, {
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      map.setView([latitude, longitude], 16)

      // Dot with engineer initials
      const initials = (engineerInitials || '?').toUpperCase()
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 30px; height: 30px; border-radius: 50%;
          background: #4f46e5; border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 11px; font-weight: 700;
          letter-spacing: 0.5px;
        ">${initials}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })

      L.marker([latitude, longitude], { icon }).addTo(map)

      // Accuracy circle
      if (accuracy && accuracy > 0) {
        L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#6366f1',
          fillColor: '#6366f1',
          fillOpacity: 0.1,
          weight: 1,
        }).addTo(map)
      }

      leafletMap.current = map
    }

    initMap()

    return () => {
      cancelled = true
      if (leafletMap.current) {
        leafletMap.current.remove()
        leafletMap.current = null
      }
    }
  }, [showMap, latitude, longitude, accuracy, engineerInitials])

  const handleMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setShowMap(true)
  }

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setShowMap(false), 200)
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Pushpin icon */}
      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 transition-colors text-indigo-600"
        title="View collection location"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </a>

      {/* Map popout — to the right of the pushpin */}
      {showMap && (
        <div
          className="absolute z-50 top-1/2 -translate-y-1/2 left-full ml-2"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden" style={{ width: 280, height: 200 }}>
            <div ref={mapRef} className="w-full h-full" />
          </div>
          {accuracy != null && (
            <div className="text-center mt-1 text-[10px] text-slate-400">
              ±{Math.round(accuracy)}m accuracy
            </div>
          )}
          {/* Arrow pointing left */}
          <div className="absolute top-1/2 -translate-y-1/2 -left-[7px] w-3 h-3 rotate-45 bg-white border-l border-b border-gray-200" />
        </div>
      )}
    </div>
  )
}
