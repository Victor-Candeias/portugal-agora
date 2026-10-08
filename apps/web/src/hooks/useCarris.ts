import { useQuery } from '@tanstack/react-query'
import { findNearbyStops, lisbonServiceDay } from '@portugal-hoje/core'
import { carrisClient } from '@/lib/clients'

// Lógica de dados (queries ao `.sqlite` estático e pedidos à API Carris) vive em
// packages/core/src/api/carris.ts (MOB-002). Aqui ficam apenas os hooks React Query do web.
export type {
  CMLine, CMOperator, CMStop, CMVehicle, CMRealtime, CMMunicipality, CMPattern, CMScheduledDeparture,
} from '@portugal-hoje/core'

// ── Municipalities (endpoint only exists on v1, not v2) ────────────────────

export function useCarrisMunicipalities() {
  return useQuery({
    queryKey: ['cm', 'municipalities'],
    queryFn: () => carrisClient.getMunicipalities(),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}

// ── Lines (dados estáticos → .sqlite local) ────────────────────────────────

export function useCarrisLines(municipalityFilter: string | null = null) {
  return useQuery({
    queryKey: ['cm', 'lines', municipalityFilter],
    queryFn: () => carrisClient.getLines(municipalityFilter),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

// ── Operators (dados estáticos → .sqlite local, via GTFS) ─────────────────

export function useCarrisOperators() {
  return useQuery({
    queryKey: ['cm', 'operators'],
    queryFn: () => carrisClient.getOperators(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

// ── Line patterns (dados estáticos → .sqlite local) ────────────────────────

export function useCarrisLinePatterns(patternIds: string[]) {
  return useQuery({
    queryKey: ['cm', 'patterns', ...patternIds],
    queryFn: () => carrisClient.getLinePatterns(patternIds),
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
    queryFn: () => carrisClient.getStops(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

export function useNearbyStops(lat: number | null, lon: number | null, radiusKm = 0.5) {
  const { data: stops = [] } = useCarrisStops()
  if (!lat || !lon) return []
  return findNearbyStops(stops, lat, lon, radiusKm)
}

// ── Vehicles ──────────────────────────────────────────────────────────────

export function useCarrisVehicles(lineFilter: string | null = null) {
  return useQuery({
    queryKey: ['cm', 'vehicles', lineFilter],
    queryFn: () => carrisClient.getVehicles(lineFilter),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  })
}

// ── Realtime arrivals at stop (v2 arrivals endpoint) ──────────────────────

export function useStopRealtime(stopId: string | null) {
  return useQuery({
    queryKey: ['cm', 'stop-realtime', stopId],
    queryFn: () => carrisClient.getStopRealtime(stopId!),
    enabled: Boolean(stopId),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  })
}

// ── Horários programados (GTFS → .sqlite local, WEB-012) ──────────────────

export function useStopSchedule(stopId: string | null) {
  const { date } = lisbonServiceDay()
  return useQuery({
    queryKey: ['cm', 'stop-schedule', stopId, date],
    queryFn: () => carrisClient.getStopSchedule(stopId!, date),
    enabled: Boolean(stopId),
    staleTime: Infinity,
    retry: 1,
  })
}

export function useLineSchedule(lineId: string | null) {
  const { date } = lisbonServiceDay()
  return useQuery({
    queryKey: ['cm', 'line-schedule', lineId, date],
    queryFn: () => carrisClient.getLineSchedule(lineId!, date),
    enabled: Boolean(lineId),
    staleTime: Infinity,
    retry: 1,
  })
}

// ── Lines map (id → CMLine) ───────────────────────────────────────────────

export function useCarrisLinesMap() {
  const { data: lines = [] } = useCarrisLines()
  return new Map(lines.map(l => [l.id, l]))
}
