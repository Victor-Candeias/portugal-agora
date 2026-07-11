import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

export function useEconomicIndicators() {
  return useQuery({
    queryKey: ['economy', 'indicators'],
    queryFn: () => apiClient.getEconomicIndicators({ limit: 20 }),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

export function useInterestRates() {
  return useQuery({
    queryKey: ['economy', 'rates'],
    queryFn: () => apiClient.getInterestRates(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}
