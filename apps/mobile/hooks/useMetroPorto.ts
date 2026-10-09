import { useQuery } from '@tanstack/react-query'
import { metroPortoClient } from '../lib/clients'

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

/** Próximas partidas a partir da hora atual, respeitando o calendário GTFS. */
export function useMetroNextDepartures(stationId?: string) {
  return useQuery({
    queryKey: ['metro-porto', 'next-departures', stationId],
    queryFn: () => metroPortoClient.getNextDepartures(stationId ?? '', new Date()),
    enabled: !!stationId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}
