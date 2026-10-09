import { useQuery } from '@tanstack/react-query'
import { openMeteoClient } from '@portugal-hoje/core'
import { apiClient } from '../lib/api'

export const DEFAULT_CITY_ID = 1110600 // Lisboa

// Previsão IPMA (~3 dias) para as capitais de distrito e ilhas, via API Aberta — um só pedido.
export function useIpmaForecasts() {
  return useQuery({
    queryKey: ['ipma', 'forecasts'],
    queryFn: () => apiClient.getIpmaForecasts(),
    staleTime: 60 * 60 * 1000,
    select: (res) =>
      res.data.map(city => ({
        ...city,
        latitude: Number(city.latitude),
        longitude: Number(city.longitude),
      })),
  })
}

// Tempo atual (Open-Meteo, sem chave): a API Aberta não tem observações.
export function useCurrentWeather(lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['openmeteo', 'current', lat, lng],
    queryFn: () => openMeteoClient.getCurrent(lat!, lng!),
    enabled: lat !== undefined && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng),
    staleTime: 15 * 60 * 1000,
  })
}
