import { useState, useCallback, useEffect } from 'react'
import 'leaflet/dist/leaflet.css'

// ── Mapa inline de um único ponto (usado para "Ver no mapa" sem sair da página) ─
export function SinglePointMap({ lat, lon, label, className }: { lat: number; lon: number; label: string; className?: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const mapDivRef = useCallback((node: HTMLDivElement | null) => setContainer(node), [])

  useEffect(() => {
    if (!container) return
    let cancelled = false
    let createdMap: import('leaflet').Map | null = null
    import('leaflet').then((L) => {
      if (cancelled) return
      const map = L.map(container).setView([lat, lon], 15)
      createdMap = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)
      L.marker([lat, lon]).addTo(map).bindPopup(label).openPopup()
    })
    return () => {
      cancelled = true
      createdMap?.remove()
    }
  }, [container, lat, lon, label])

  return <div ref={mapDivRef} className={className ?? 'w-full h-56 rounded-xl border border-slate-200 overflow-hidden'} />
}
