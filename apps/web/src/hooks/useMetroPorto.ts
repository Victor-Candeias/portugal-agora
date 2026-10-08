// Hooks React Query para o Metro do Porto. As queries ao `.sqlite` estático (GTFS, WEB-022)
// vivem em packages/core/src/api/metroPorto.ts (MOB-002); o motor SQLite (sql.js/WASM) é
// injetado em src/lib/clients.ts.
import { useQuery } from '@tanstack/react-query'
import { metroPortoClient } from '@/lib/clients'

export type { MetroStation, MetroLine, MetroDeparture } from '@portugal-hoje/core'
export { secondsSinceMidnight, formatDepartureTime } from '@portugal-hoje/core'

export function useMetroPortoMeta() {
  return useQuery({
    queryKey: ['metro-porto', 'meta'],
    queryFn: () => metroPortoClient.getDbMeta(),
    staleTime: Infinity,
  })
}

export function useMetroStations() {
  return useQuery({
    queryKey: ['metro-porto', 'stations'],
    queryFn: () => metroPortoClient.getStations(),
    staleTime: Infinity,
  })
}

export function useMetroStationLines(stationId?: string) {
  return useQuery({
    queryKey: ['metro-porto', 'station-lines', stationId],
    queryFn: () => metroPortoClient.getStationLines(stationId ?? ''),
    enabled: !!stationId,
    staleTime: Infinity,
  })
}

/** Próximas partidas de uma estação, a partir da hora atual, respeitando o calendário GTFS. */
export function useMetroNextDepartures(stationId?: string) {
  return useQuery({
    queryKey: ['metro-porto', 'next-departures', stationId],
    queryFn: () => metroPortoClient.getNextDepartures(stationId ?? '', new Date()),
    enabled: !!stationId,
    // A "próxima partida" depende da hora atual — refresca com regularidade, mas não a cada render.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}
