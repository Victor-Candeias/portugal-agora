import { useQuery } from '@tanstack/react-query'

// ── Base URL ──────────────────────────────────────────────────────────────
// API has Access-Control-Allow-Origin: * — no proxy needed.

const BASE_V2 = 'https://api.carrismetropolitana.pt/v2'
const BASE_V1 = 'https://api.carrismetropolitana.pt/v1'

// ── Helpers ───────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Carris API error ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface CMLine {
  id: string
  short_name: string
  long_name: string
  color: string
  text_color: string
  municipality_ids: string[]
  pattern_ids: string[]
}

export interface CMStop {
  id: string
  long_name: string
  short_name: string | null
  lat: number
  lon: number
  municipality_id: string
  municipality_name: string
  locality_name: string
  line_ids: string[]
  wheelchair_boarding: boolean
}

export interface CMVehicle {
  id: string
  line_id: string
  pattern_id: string
  route_id: string
  trip_id: string
  lat: number
  lon: number
  bearing: number
  speed: number
  stop_id: string
  current_status: string
  timestamp: number
  agency_id: string
  wheelchair_accessible: boolean
  propulsion: string
}

export interface CMRealtime {
  line_id: string
  headsign: string
  pattern_id: string
  scheduled_arrival: string
  scheduled_arrival_unix: number
  estimated_arrival: string | null
  estimated_arrival_unix: number | null
  observed_arrival: string | null
  observed_arrival_unix: number | null
  vehicle_id: string
}

export interface CMMunicipality {
  id: string
  name: string
  district_id?: string
  district_name?: string
}

// ── Municipalities (endpoint only exists on v1, not v2) ────────────────────

export function useCarrisMunicipalities() {
  return useQuery({
    queryKey: ['cm', 'municipalities'],
    queryFn: async (): Promise<CMMunicipality[]> => {
      const municipalities = await fetchJson<CMMunicipality[]>(`${BASE_V1}/municipalities`)
      return [...municipalities].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}

// ── Lines ─────────────────────────────────────────────────────────────────

export function useCarrisLines(municipalityFilter: string | null = null) {
  return useQuery({
    queryKey: ['cm', 'lines', municipalityFilter],
    queryFn: async (): Promise<CMLine[]> => {
      const lines = await fetchJson<CMLine[]>(`${BASE_V2}/lines`)
      if (!municipalityFilter) return lines
      return lines.filter(l => l.municipality_ids.includes(municipalityFilter))
    },
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 12 * 60 * 60 * 1000,
    retry: 1,
  })
}

// ── Stops ─────────────────────────────────────────────────────────────────

export function useCarrisStops() {
  return useQuery({
    queryKey: ['cm', 'stops'],
    queryFn: () => fetchJson<CMStop[]>(`${BASE_V2}/stops`),
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}

export function useNearbyStops(lat: number | null, lon: number | null, radiusKm = 0.5) {
  const { data: stops = [] } = useCarrisStops()
  if (!lat || !lon) return []
  return stops
    .map(s => ({ ...s, distKm: haversineKm(lat, lon, s.lat, s.lon) }))
    .filter(s => s.distKm <= radiusKm)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 20)
}

// ── Vehicles ──────────────────────────────────────────────────────────────

export function useCarrisVehicles(lineFilter: string | null = null) {
  return useQuery({
    queryKey: ['cm', 'vehicles', lineFilter],
    queryFn: async (): Promise<CMVehicle[]> => {
      const vehicles = await fetchJson<CMVehicle[]>(`${BASE_V2}/vehicles`)
      const active = vehicles.filter(v => v.lat && v.lon)
      if (!lineFilter) return active
      return active.filter(v => v.line_id === lineFilter)
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  })
}

// ── Realtime arrivals at stop ─────────────────────────────────────────────

export function useStopRealtime(stopId: string | null) {
  return useQuery({
    queryKey: ['cm', 'stop-realtime', stopId],
    queryFn: () => fetchJson<CMRealtime[]>(`${BASE_V1}/stops/${stopId}/realtime`),
    enabled: Boolean(stopId),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  })
}

// ── Lines map (id → CMLine) ───────────────────────────────────────────────

export function useCarrisLinesMap() {
  const { data: lines = [] } = useCarrisLines()
  return new Map(lines.map(l => [l.id, l]))
}
