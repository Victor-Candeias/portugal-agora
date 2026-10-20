import { useState, useCallback, useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { ANACOM_COVERAGE_EXTENT, ANACOM_MAP_URL, PORTUGAL_MAINLAND_BOUNDS, anacomExportUrl } from '@portugal-hoje/core'

const { west, south, east, north } = PORTUGAL_MAINLAND_BOUNDS
const EXTENT = ANACOM_COVERAGE_EXTENT
const HALF_WORLD_M = 20037508.342789244
const BBOX_TOKEN = '{bbox-epsg-3857}'

/** Bbox EPSG:3857 de um mosaico XYZ, para o `export` da ANACOM. */
function tileBbox3857(x: number, y: number, z: number): string {
  const size = (2 * HALF_WORLD_M) / 2 ** z
  const minX = -HALF_WORLD_M + x * size
  const maxY = HALF_WORLD_M - y * size
  return `${minX},${maxY - size},${minX + size},${maxY}`
}

interface Props {
  /** Camada ANACOM (operadora + tecnologia) a sobrepor. */
  layerId: number
  opacity: number
  point: { lat: number; lon: number } | null
  /** Muda quando o ponto vem do GPS ou da pesquisa: o mapa centra-se nele. */
  focusKey: number
  onPick: (lat: number, lon: number) => void
  className?: string
}

// ── Mapa da cobertura móvel (WEB-066): OSM + imagens `export` da ANACOM, clique para escolher o ponto ─
export function CoverageMap({ layerId, opacity, point, focusKey, onPick, className }: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const mapDivRef = useCallback((node: HTMLDivElement | null) => setContainer(node), [])
  const [leaflet, setLeaflet] = useState<{ L: typeof import('leaflet'); map: import('leaflet').Map } | null>(null)
  const overlayRef = useRef<import('leaflet').TileLayer | null>(null)
  const markerRef = useRef<import('leaflet').CircleMarker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  // Lidos por ref: a opacidade não recria a camada e o ponto só centra o mapa quando o `focusKey` muda.
  const opacityRef = useRef(opacity)
  opacityRef.current = opacity
  const pointRef = useRef(point)
  pointRef.current = point

  useEffect(() => {
    if (!container) return
    let cancelled = false
    let createdMap: import('leaflet').Map | null = null
    import('leaflet').then((L) => {
      if (cancelled) return
      const map = L.map(container).fitBounds([[south, west], [north, east]])
      createdMap = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => onPickRef.current(e.latlng.lat, e.latlng.lng))
      setLeaflet({ L, map })
    })
    return () => {
      cancelled = true
      overlayRef.current = null
      markerRef.current = null
      setLeaflet(null)
      createdMap?.remove()
    }
  }, [container])

  // Sobreposição da ANACOM: recriada quando muda a operadora/tecnologia.
  useEffect(() => {
    if (!leaflet) return
    const { L, map } = leaflet
    const template = anacomExportUrl(layerId)
    const AnacomLayer = L.TileLayer.extend({
      getTileUrl(coords: import('leaflet').Coords) {
        return template.replace(BBOX_TOKEN, tileBbox3857(coords.x, coords.y, coords.z))
      },
    }) as unknown as new (url: string, options: import('leaflet').TileLayerOptions) => import('leaflet').TileLayer
    const layer = new AnacomLayer(template, {
      tileSize: 256,
      maxZoom: 18,
      opacity: opacityRef.current,
      bounds: L.latLngBounds([EXTENT.south, EXTENT.west], [EXTENT.north, EXTENT.east]),
      attribution: `<a href="${ANACOM_MAP_URL}" target="_blank" rel="noopener noreferrer">© ANACOM</a>`,
    }).addTo(map)
    overlayRef.current = layer
    return () => {
      layer.remove()
      if (overlayRef.current === layer) overlayRef.current = null
    }
  }, [leaflet, layerId])

  useEffect(() => {
    overlayRef.current?.setOpacity(opacity)
  }, [opacity, leaflet, layerId])

  useEffect(() => {
    if (!leaflet) return
    const { L, map } = leaflet
    markerRef.current?.remove()
    markerRef.current = point
      ? L.circleMarker([point.lat, point.lon], { radius: 9, color: '#ffffff', weight: 3, fillColor: '#1d4ed8', fillOpacity: 1 }).addTo(map)
      : null
  }, [leaflet, point])

  useEffect(() => {
    const p = pointRef.current
    if (!leaflet || !p || focusKey === 0) return
    leaflet.map.setView([p.lat, p.lon], Math.max(leaflet.map.getZoom(), 13))
  }, [leaflet, focusKey])

  return (
    <div
      ref={mapDivRef}
      className={className ?? 'w-full h-[28rem] rounded-xl border border-slate-200 overflow-hidden cursor-crosshair'}
      role="application"
      aria-label="Mapa de cobertura móvel. Clique num ponto para ver a cobertura nesse local."
    />
  )
}
