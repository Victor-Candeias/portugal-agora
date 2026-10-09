import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/clients'

// Taxas BCE, €STR e TBA (Banco de Portugal / BCE).
export function useBdpRates() {
  return useQuery({
    queryKey: ['bdp', 'rates'],
    queryFn: () => apiClient.getBdpRates(),
    staleTime: 6 * 60 * 60 * 1000,
  })
}

// Taxas de juro de novos empréstimos e depósitos a prazo (mensal).
export function useBdpLendingRates() {
  return useQuery({
    queryKey: ['bdp', 'lending-rates'],
    queryFn: () => apiClient.getBdpLendingRates(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

// Últimos indicadores anuais INE/Eurostat.
export function useIneLatest() {
  return useQuery({
    queryKey: ['ine', 'latest'],
    queryFn: () => apiClient.getIneLatest(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}
