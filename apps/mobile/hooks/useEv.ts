import { useQuery } from '@tanstack/react-query'
import { shouldRetryOpenChargeMap, type NearbyEvChargersParams } from '@portugal-hoje/core'
import { apiClient } from '../lib/api'
import { openChargeMapClient } from '../lib/clients'

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

// Postos de carregamento perto de um ponto (Open Charge Map, WEB-040). As coordenadas entram na
// chave arredondadas (~100 m) para não repetir o pedido por pequenas variações do GPS.
export function useEvChargers(params: NearbyEvChargersParams | null) {
  return useQuery({
    queryKey: [
      'ev', 'chargers',
      params?.latitude.toFixed(3), params?.longitude.toFixed(3), params?.radiusKm, params?.minPowerKw ?? 0,
    ],
    queryFn: () => openChargeMapClient.getNearbyChargers(params!),
    enabled: params !== null,
    staleTime: 10 * 60 * 1000,
    retry: shouldRetryOpenChargeMap,
  })
}
