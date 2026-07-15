import { useQuery } from '@tanstack/react-query'
import { queryAll } from '@/lib/staticDb'

// ── Base URL ──────────────────────────────────────────────────────────────
// API has Access-Control-Allow-Origin: * — no proxy needed.
// NOTA: linhas, paragens, patterns e operadores (dados estáticos) já não são
// pedidos aqui em tempo real — vêm do `.sqlite` local gerado em build/CI
// (ver apps/web/scripts/build-carris-db.mjs e src/lib/staticDb.ts, WEB-010/011/016).
// Só os dados dinâmicos (veículos, chegadas) continuam a usar estas bases.

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
  route_ids: string[]
  operator_id: string | null
}

export interface CMOperator {
  id: string
  name: string
  website: string | null
  timezone: string | null
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
  facilities: string[]
  operational_status: string
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
  route_id?: string
  trip_id?: string
  stop_sequence?: number
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

// ── Lines (dados estáticos → .sqlite local) ────────────────────────────────

export function useCarrisLines(municipalityFilter: string | null = null) {
  return useQuery({
    queryKey: ['cm', 'lines', municipalityFilter],
    queryFn: async (): Promise<CMLine[]> => {
      const rows = await queryAll<{
        id: string; short_name: string; long_name: string; color: string
        text_color: string; operator_id: string | null
      }>('SELECT id, short_name, long_name, color, text_color, operator_id FROM lines')

      const [muniRows, routeRows, patternRows] = await Promise.all([
        queryAll<{ line_id: string; municipality_id: string }>('SELECT line_id, municipality_id FROM line_municipalities'),
        queryAll<{ line_id: string; route_id: string }>('SELECT line_id, route_id FROM line_routes'),
        queryAll<{ line_id: string; pattern_id: string }>('SELECT line_id, pattern_id FROM line_patterns'),
      ])
      const groupBy = <T extends { line_id: string }>(rows: T[], key: keyof T) => {
        const map = new Map<string, string[]>()
        for (const r of rows) {
          const arr = map.get(r.line_id) ?? []
          arr.push(String(r[key]))
          map.set(r.line_id, arr)
        }
        return map
      }
      const munis = groupBy(muniRows, 'municipality_id')
      const routes = groupBy(routeRows, 'route_id')
      const patterns = groupBy(patternRows, 'pattern_id')

      const lines: CMLine[] = rows.map(l => ({
        ...l,
        municipality_ids: munis.get(l.id) ?? [],
        route_ids: routes.get(l.id) ?? [],
        pattern_ids: patterns.get(l.id) ?? [],
      }))
      if (!municipalityFilter) return lines
      return lines.filter(l => l.municipality_ids.includes(municipalityFilter))
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

// ── Operators (dados estáticos → .sqlite local, via GTFS) ─────────────────

export function useCarrisOperators() {
  return useQuery({
    queryKey: ['cm', 'operators'],
    queryFn: () => queryAll<CMOperator>('SELECT id, name, website, timezone FROM operators'),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

// ── Line patterns (dados estáticos → .sqlite local) ────────────────────────

export interface CMPattern {
  id: string
  line_id: string
  direction_id: number
  headsign: string
  color: string
  municipality_ids: string[]
  path: { stop_id: string; stop_sequence: number; distance: number }[]
}

export function useCarrisLinePatterns(patternIds: string[]) {
  return useQuery({
    queryKey: ['cm', 'patterns', ...patternIds],
    queryFn: async (): Promise<CMPattern[]> => {
      if (patternIds.length === 0) return []
      const placeholders = patternIds.map(() => '?').join(',')
      const rows = await queryAll<{
        id: string; line_id: string; direction_id: number; headsign: string; color: string
      }>(`SELECT id, line_id, direction_id, headsign, color FROM patterns WHERE id IN (${placeholders})`, patternIds)
      const pathRows = await queryAll<{ pattern_id: string; stop_id: string; stop_sequence: number; distance: number }>(
        `SELECT pattern_id, stop_id, stop_sequence, distance FROM pattern_path WHERE pattern_id IN (${placeholders}) ORDER BY stop_sequence`,
        patternIds,
      )
      const pathByPattern = new Map<string, CMPattern['path']>()
      for (const p of pathRows) {
        const arr = pathByPattern.get(p.pattern_id) ?? []
        arr.push({ stop_id: p.stop_id, stop_sequence: p.stop_sequence, distance: p.distance })
        pathByPattern.set(p.pattern_id, arr)
      }
      return rows.map(r => ({ ...r, municipality_ids: [], path: pathByPattern.get(r.id) ?? [] }))
    },
    enabled: patternIds.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

// ── Stops (dados estáticos → .sqlite local) ────────────────────────────────

export function useCarrisStops() {
  return useQuery({
    queryKey: ['cm', 'stops'],
    queryFn: async (): Promise<CMStop[]> => {
      const rows = await queryAll<{
        id: string; long_name: string; short_name: string | null; lat: number; lon: number
        municipality_id: string; municipality_name: string; locality_name: string
        wheelchair_boarding: number; facilities: string; operational_status: string
      }>('SELECT * FROM stops')
      const lineRows = await queryAll<{ stop_id: string; line_id: string }>('SELECT stop_id, line_id FROM stop_lines')
      const linesByStop = new Map<string, string[]>()
      for (const r of lineRows) {
        const arr = linesByStop.get(r.stop_id) ?? []
        arr.push(r.line_id)
        linesByStop.set(r.stop_id, arr)
      }
      return rows.map(s => ({
        id: s.id,
        long_name: s.long_name,
        short_name: s.short_name,
        lat: s.lat,
        lon: s.lon,
        municipality_id: s.municipality_id,
        municipality_name: s.municipality_name,
        locality_name: s.locality_name,
        line_ids: linesByStop.get(s.id) ?? [],
        wheelchair_boarding: s.wheelchair_boarding === 1,
        facilities: JSON.parse(s.facilities || '[]'),
        operational_status: s.operational_status,
      }))
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

export function useNearbyStops(lat: number | null, lon: number | null, radiusKm = 0.5) {
  const { data: stops = [] } = useCarrisStops()
  if (!lat || !lon) return []
  return stops
    .filter(s => s.operational_status === 'ACTIVE')
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

// ── Realtime arrivals at stop (v2 arrivals endpoint — fixes malformed trip_id
// that v1's /stops/{id}/realtime returns) ──────────────────────────────────

export function useStopRealtime(stopId: string | null) {
  return useQuery({
    queryKey: ['cm', 'stop-realtime', stopId],
    queryFn: () => fetchJson<CMRealtime[]>(`${BASE_V2}/arrivals/by_stop/${stopId}`),
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
