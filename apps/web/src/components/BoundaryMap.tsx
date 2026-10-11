import { useState, useCallback, useEffect } from 'react'
import type { GeoBoundary } from '@portugal-hoje/core'
import 'leaflet/dist/leaflet.css'

// Fronteira de um concelho (GeoJSON) num mapa Leaflet, enquadrada nos seus limites (WEB-042).
export function BoundaryMap({ boundary, className }: { boundary: GeoBoundary; className?: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const mapDivRef = useCallback((node: HTMLDivElement | null) => setContainer(node), [])

  useEffect(() => {
    if (!container) return
    let cancelled = false
    let createdMap: import('leaflet').Map | null = null
    import('leaflet').then((L) => {
      if (cancelled) return
      const map = L.map(container)
      createdMap = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)
      const layer = L.geoJSON(boundary as GeoJSON.Feature, {
        style: { color: '#16a34a', weight: 2, fillColor: '#16a34a', fillOpacity: 0.12 },
      }).addTo(map)
      map.fitBounds(layer.getBounds(), { padding: [16, 16] })
    })
    return () => {
      cancelled = true
      createdMap?.remove()
    }
  }, [container, boundary])

  return <div ref={mapDivRef} className={className ?? 'w-full h-80 rounded-xl border border-slate-200 overflow-hidden'} />
}
