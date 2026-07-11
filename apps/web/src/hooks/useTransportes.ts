import { useQuery } from '@tanstack/react-query'

// ── Comboios CP (comboios.live) ───────────────────────────────────────────

export interface Train {
  trainNumber: number
  runDate: string
  delay: number           // seconds (positive = late, negative = early)
  status: 'IN_TRANSIT' | 'AT_STATION' | 'AT_ORIGIN' | 'NEAR_NEXT'
  hasDisruptions: boolean
  latitude: string
  longitude: string
  lastStationPlatform: string
  service: { code: string; designation: string }
  origin: { code: string; designation: string }
  destination: { code: string; designation: string }
  timestamp: number
}

export interface Station {
  code: string
  designation: string
  latitude: string
  longitude: string
  railways: string[]
}

export function useTrains() {
  return useQuery({
    queryKey: ['cp', 'vehicles'],
    queryFn: async (): Promise<Train[]> => {
      const res = await fetch('https://comboios.live/api/vehicles')
      if (!res.ok) throw new Error('Erro ao carregar comboios')
      const data = await res.json()
      return (data.vehicles as Train[]).sort((a, b) => b.delay - a.delay)
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  })
}

export function useStations() {
  return useQuery({
    queryKey: ['cp', 'stations'],
    queryFn: async (): Promise<Station[]> => {
      const res = await fetch('https://comboios.live/api/stations')
      if (!res.ok) throw new Error('Erro ao carregar estações')
      const data = await res.json()
      return data.stations as Station[]
    },
    staleTime: 24 * 60 * 60 * 1000,
  })
}

// ── Alertas TML ───────────────────────────────────────────────────────────

export interface TmlAlert {
  _id: string
  active_period_start_date: number
  active_period_end_date: number
  agency_id: string
  cause: string
  effect: string
  title: string
  description: string
  coordinates: [number, number] | null
  municipality_ids: string[]
  reference_type: string
  references: { parent_id: string; child_ids: string[] }[]
  info_url: string | null
}

export function useTmlAlerts() {
  return useQuery({
    queryKey: ['tml', 'alerts'],
    queryFn: async (): Promise<TmlAlert[]> => {
      const res = await fetch('https://go.tmlmobilidade.pt/hub/api/v1/alerts')
      if (!res.ok) throw new Error('Erro ao carregar alertas TML')
      const data = await res.json()
      return (data.data as TmlAlert[]).sort(
        (a, b) => b.active_period_start_date - a.active_period_start_date,
      )
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
