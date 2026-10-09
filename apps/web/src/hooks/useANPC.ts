import { useQuery } from '@tanstack/react-query'
import { anpcClient } from '@/lib/clients'

// Lógica de dados em packages/core/src/api/anpc.ts (MOB-002); API key injetada em src/lib/clients.ts.
export type { AnpcIncident, AnpcSummary, AnpcIncidentsResponse, AnpcWarningItem } from '@portugal-hoje/core'

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

// Comunicados da ANPC (WEB-026), do mais recente para o mais antigo.
export function useAnpcWarnings() {
  return useQuery({
    queryKey: ['anpc', 'warnings'],
    queryFn: () => anpcClient.getWarnings(),
    staleTime: 15 * 60 * 1000,
  })
}
