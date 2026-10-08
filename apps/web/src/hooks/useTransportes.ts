import { useQuery } from '@tanstack/react-query'
import { comboiosClient, tmlClient } from '@/lib/clients'

// Lógica de dados em packages/core/src/api/comboios.ts e tml.ts (MOB-002).
// O proxy CORS do comboios.live é configurado em src/lib/clients.ts.
export type { Train, Station, TmlAlert } from '@portugal-hoje/core'

// ── Comboios CP (comboios.live) ───────────────────────────────────────────

export function useTrains() {
  return useQuery({
    queryKey: ['cp', 'vehicles'],
    queryFn: () => comboiosClient.getTrains(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  })
}

export function useStations() {
  return useQuery({
    queryKey: ['cp', 'stations'],
    queryFn: () => comboiosClient.getStations(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

// ── Alertas TML ───────────────────────────────────────────────────────────

export function useTmlAlerts() {
  return useQuery({
    queryKey: ['tml', 'alerts'],
    queryFn: () => tmlClient.getAlerts(),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
