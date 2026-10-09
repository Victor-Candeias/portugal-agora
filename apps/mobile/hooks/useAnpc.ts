import { useQuery } from '@tanstack/react-query'
import { ipmaClient } from '@portugal-hoje/core'
import { anpcClient } from '../lib/clients'

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

// Risco de incêndio rural (RCM do IPMA, open-data, sem chave) agregado por distrito (MOB-008).
export function useFireRisk(day: 0 | 1 = 0) {
  return useQuery({
    queryKey: ['ipma', 'fire-risk', day],
    queryFn: () => ipmaClient.getFireRiskByDistrict(day),
    staleTime: 60 * 60 * 1000,
  })
}
