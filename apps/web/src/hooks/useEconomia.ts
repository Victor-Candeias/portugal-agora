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

// Indicadores INE/Eurostat disponíveis e anos com dados (WEB-030).
export function useIneIndicators() {
  return useQuery({
    queryKey: ['ine', 'indicators'],
    queryFn: () => apiClient.getIneIndicators(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

// Série anual de um indicador desde `from` (o 1.º ano de /ine/indicators; sem ele a API começa em 2000).
// O intervalo de anos escolhido é recortado no ecrã, sem novo pedido.
export function useIneSeries(indicator: string | null, from?: number) {
  return useQuery({
    queryKey: ['ine', 'stats', indicator, from],
    queryFn: async () => {
      const res = await apiClient.getIneStats({ indicator: indicator!, from })
      return res.data.find(s => s.indicator === indicator) ?? null
    },
    enabled: !!indicator,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
