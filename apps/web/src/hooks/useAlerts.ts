import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

export function useCivilProtectionAlerts(district?: string) {
  return useQuery({
    queryKey: ['anpc', 'alerts', district],
    queryFn: () => apiClient.getCivilProtectionAlerts({ district }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useFireRisk(district?: string) {
  return useQuery({
    queryKey: ['anpc', 'fire-risk', district],
    queryFn: () => apiClient.getFireRisk({ district }),
    staleTime: 60 * 60 * 1000,
  })
}
