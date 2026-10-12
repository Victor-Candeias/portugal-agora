import { useState, useCallback, useEffect, useRef } from 'react'
import { parishesFeatureCollection, type GeoBoundary, type MunicipalityParish } from '@portugal-hoje/core'
import 'leaflet/dist/leaflet.css'

const COLOR = '#16a34a'
const PADDING: [number, number] = [16, 16]
const PARISH_STYLE = { color: '#15803d', weight: 1, opacity: 0.8, fillColor: COLOR, fillOpacity: 0.06 }
const SELECTED_STYLE = { color: '#c2410c', weight: 2.5, opacity: 1, fillColor: '#f97316', fillOpacity: 0.3 }

interface MapState {
  map: import('leaflet').Map
  boundsAll: import('leaflet').LatLngBounds
  parishLayers: Map<string, import('leaflet').Polygon>
}

// Fronteira de um concelho (GeoJSON) num mapa Leaflet, enquadrada nos seus limites (WEB-042).
// Com `parishes`, desenha também os limites das freguesias (WEB-049): o clique seleciona a freguesia,
// que fica destacada e enquadrada; sem seleção, o mapa volta ao concelho.
export function BoundaryMap({
  boundary,
  parishes,
  selectedParish = null,
  onSelectParish,
  className,
}: {
  boundary: GeoBoundary
  parishes?: MunicipalityParish[]
  selectedParish?: string | null
  onSelectParish?: (code: string | null) => void
  className?: string
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const mapDivRef = useCallback((node: HTMLDivElement | null) => setContainer(node), [])
  const stateRef = useRef<MapState | null>(null)
  const [mapVersion, setMapVersion] = useState(0)
  const onSelectRef = useRef(onSelectParish)
  const selectedRef = useRef(selectedParish)

  useEffect(() => {
    onSelectRef.current = onSelectParish
    selectedRef.current = selectedParish
  })

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

      const parishLayers = new Map<string, import('leaflet').Polygon>()
      const hasParishes = !!parishes?.length
      if (hasParishes) {
        L.geoJSON(parishesFeatureCollection(parishes!) as GeoJSON.FeatureCollection, {
          style: PARISH_STYLE,
          onEachFeature: (feature, layer) => {
            const { code, name } = feature.properties as { code: string; name: string }
            parishLayers.set(code, layer as import('leaflet').Polygon)
            layer.bindTooltip(name, { sticky: true })
            layer.on('click', () => onSelectRef.current?.(selectedRef.current === code ? null : code))
          },
        }).addTo(map)
      }
      // A fronteira do concelho fica por cima e não interativa, para os cliques chegarem às freguesias.
      const outline = L.geoJSON(boundary as GeoJSON.Feature, {
        interactive: false,
        style: hasParishes
          ? { color: COLOR, weight: 2.5, fill: false }
          : { color: COLOR, weight: 2, fillColor: COLOR, fillOpacity: 0.12 },
      }).addTo(map)
      const boundsAll = outline.getBounds()
      map.fitBounds(boundsAll, { padding: PADDING })
      stateRef.current = { map, boundsAll, parishLayers }
      setMapVersion(v => v + 1)
    })
    return () => {
      cancelled = true
      stateRef.current = null
      createdMap?.remove()
    }
  }, [container, boundary, parishes])

  useEffect(() => {
    const state = stateRef.current
    if (!state || state.parishLayers.size === 0) return
    let selected: import('leaflet').Polygon | null = null
    for (const [code, layer] of state.parishLayers) {
      if (code === selectedParish) {
        selected = layer
        layer.setStyle(SELECTED_STYLE)
        layer.bringToFront()
      } else {
        layer.setStyle(PARISH_STYLE)
      }
    }
    state.map.fitBounds(selected ? selected.getBounds() : state.boundsAll, { padding: PADDING })
  }, [selectedParish, mapVersion])

  return <div ref={mapDivRef} className={className ?? 'w-full h-80 rounded-xl border border-slate-200 overflow-hidden'} />
}
