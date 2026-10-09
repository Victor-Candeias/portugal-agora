import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/clients'

// Tarifas de carregamento dos CEME (API Aberta /ev).
export function useEvTariffs() {
  return useQuery({
    queryKey: ['ev', 'tariffs'],
    queryFn: () => apiClient.getEvTariffs(),
    staleTime: 15 * 60 * 1000,
  })
}

// Custo de um carregamento de `kwh` por CEME, do mais barato para o mais caro.
export function useCheapestEvTariffs(kwh: number) {
  return useQuery({
    queryKey: ['ev', 'cheapest', kwh],
    queryFn: () => apiClient.getCheapestEvTariffs(kwh),
    enabled: kwh > 0,
    staleTime: 15 * 60 * 1000,
  })
}
