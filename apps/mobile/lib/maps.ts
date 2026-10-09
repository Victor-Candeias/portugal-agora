import { Linking } from 'react-native'
import type { LngLat, LngLatBounds, StyleSpecification } from '@maplibre/maplibre-react-native'

// Mosaicos raster do OpenStreetMap (os mesmos do Leaflet no web) — sem chave nem conta Google.
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

export type MapPoint = {
  id: string
  latitude: number
  longitude: number
  label: string
  description?: string
}

export const SINGLE_POINT_ZOOM = 15

export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
}

// No Android o URL universal do Google Maps abre a app nativa (se instalada); senão abre o browser.
export function openDirections(latitude: number, longitude: number): Promise<void> {
  return Linking.openURL(directionsUrl(latitude, longitude))
}

export type MapView =
  | { center: LngLat; zoom: number }
  | { bounds: LngLatBounds }

// Enquadramento: um ponto (ou pontos praticamente coincidentes) → centro + zoom; vários → limites.
export function viewForPoints(points: MapPoint[]): MapView | null {
  const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
  if (valid.length === 0) return null
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const p of valid) {
    west = Math.min(west, p.longitude)
    east = Math.max(east, p.longitude)
    south = Math.min(south, p.latitude)
    north = Math.max(north, p.latitude)
  }
  if (east - west < 0.002 && north - south < 0.002) {
    return { center: [(west + east) / 2, (south + north) / 2], zoom: SINGLE_POINT_ZOOM }
  }
  return { bounds: [west, south, east, north] }
}
