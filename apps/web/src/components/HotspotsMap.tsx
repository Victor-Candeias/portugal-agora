import { useState, useCallback, useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import {
  FIRMS_AGE_COLORS,
  PORTUGAL_MAINLAND_BOUNDS,
  describeFirmsHotspot,
  firmsAge,
  formatFirmsAcquisition,
  type NasaFirmsHotspotItem,
} from '@portugal-hoje/core'

const { west, south, east, north } = PORTUGAL_MAINLAND_BOUNDS

// ── Mapa dos focos de calor da NASA FIRMS (WEB-027), enquadrado em Portugal continental ─
export function HotspotsMap({ hotspots, className }: { hotspots: NasaFirmsHotspotItem[]; className?: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const mapDivRef = useCallback((node: HTMLDivElement | null) => setContainer(node), [])
  const [leaflet, setLeaflet] = useState<{ L: typeof import('leaflet'); map: import('leaflet').Map } | null>(null)
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null)

  useEffect(() => {
    if (!container) return
    let cancelled = false
    let createdMap: import('leaflet').Map | null = null
    import('leaflet').then((L) => {
      if (cancelled) return
      // Canvas: aguenta milhares de focos (época de incêndios) sem um elemento DOM por ponto.
      const map = L.map(container, { preferCanvas: true }).fitBounds([[south, west], [north, east]])
      createdMap = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap · NASA FIRMS',
        maxZoom: 18,
      }).addTo(map)
      layerRef.current = L.layerGroup().addTo(map)
      setLeaflet({ L, map })
    })
    return () => {
      cancelled = true
      layerRef.current = null
      setLeaflet(null)
      createdMap?.remove()
    }
  }, [container])

  useEffect(() => {
    const layer = layerRef.current
    if (!leaflet || !layer) return
    const { L } = leaflet
    layer.clearLayers()
    const now = Date.now()
    // Do mais antigo para o mais recente, para os focos recentes ficarem por cima.
    for (const h of [...hotspots].reverse()) {
      const color = FIRMS_AGE_COLORS[firmsAge(h, now)]
      const popupEl = document.createElement('div')
      const titleEl = document.createElement('div')
      titleEl.className = 'text-sm font-medium text-slate-800'
      titleEl.textContent = `🛰️ Foco de calor · ${formatFirmsAcquisition(h)}`
      const detailEl = document.createElement('div')
      detailEl.className = 'text-xs text-slate-500 mt-1'
      detailEl.textContent = describeFirmsHotspot(h)
      popupEl.append(titleEl, detailEl)
      L.circleMarker([h.latitude, h.longitude], {
        radius: 6,
        color: 'white',
        weight: 1,
        fillColor: color,
        fillOpacity: 0.9,
      })
        .bindPopup(popupEl)
        .addTo(layer)
    }
  }, [leaflet, hotspots])

  return <div ref={mapDivRef} className={className ?? 'w-full h-96 rounded-xl border border-slate-200 overflow-hidden'} />
}
