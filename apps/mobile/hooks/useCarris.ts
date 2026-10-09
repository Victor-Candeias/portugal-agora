// Hooks Carris Metropolitana: dados estáticos do `.sqlite` local (MOB-003) e tempo real via API.
// Mesmas query keys e tempos de cache do web (apps/web/src/hooks/useCarris.ts).
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { findNearbyStops, lisbonServiceDay } from '@portugal-hoje/core'
import { carrisClient } from '../lib/clients'

export function useCarrisLines(municipalityFilter: string | null = null) {
  return useQuery({
    queryKey: ['cm', 'lines', municipalityFilter],
    queryFn: () => carrisClient.getLines(municipalityFilter),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

export function useCarrisOperators() {
  return useQuery({
    queryKey: ['cm', 'operators'],
    queryFn: () => carrisClient.getOperators(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

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
  return useMemo(
    () => (lat != null && lon != null ? findNearbyStops(stops, lat, lon, radiusKm) : []),
    [stops, lat, lon, radiusKm],
  )
}

export function useCarrisVehicles(lineFilter: string | null = null) {
  return useQuery({
    queryKey: ['cm', 'vehicles', lineFilter],
    queryFn: () => carrisClient.getVehicles(lineFilter),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  })
}

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

export function useCarrisAlerts() {
  return useQuery({
    queryKey: ['cm', 'alerts'],
    queryFn: () => carrisClient.getAlerts(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })
}

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

/** id → linha, para cores e nomes nas listas de veículos/chegadas/alertas. */
export function useCarrisLinesMap() {
  const { data: lines } = useCarrisLines()
  return useMemo(() => new Map((lines ?? []).map(l => [l.id, l])), [lines])
}
