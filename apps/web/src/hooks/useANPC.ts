import { useQuery } from '@tanstack/react-query'
import { anpcClient } from '@/lib/clients'

// Lógica de dados em packages/core/src/api/anpc.ts (MOB-002); API key injetada em src/lib/clients.ts.
export type { AnpcIncident, AnpcSummary, AnpcIncidentsResponse } from '@portugal-hoje/core'

export function useAnpcIncidents() {
  return useQuery({
    queryKey: ['anpc', 'incidents'],
    queryFn: () => anpcClient.getIncidents(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useAnpcSummary() {
  return useQuery({
    queryKey: ['anpc', 'summary'],
    queryFn: () => anpcClient.getSummary(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
