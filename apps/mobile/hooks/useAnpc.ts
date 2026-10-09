import { useQuery } from '@tanstack/react-query'
import { anpcClient } from '../lib/clients'
import { apiClient } from '../lib/api'

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

// Risco de incêndio por distrito (API Aberta). Exige uma chave válida em EXPO_PUBLIC_APIABERTA_KEY;
// sem ela o pedido dá 401 e o ecrã mostra-o como indisponível, por isso não vale a pena repetir.
export function useFireRisk() {
  return useQuery({
    queryKey: ['anpc', 'fire-risk'],
    queryFn: () => apiClient.getFireRisk(),
    staleTime: 60 * 60 * 1000,
    retry: false,
  })
}
