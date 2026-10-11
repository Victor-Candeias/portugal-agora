import { useQuery } from '@tanstack/react-query'
import { ipmaClient, openMeteoClient } from '@portugal-hoje/core'

export const DEFAULT_CITY_ID = 1110600 // Lisboa

// Locais de previsão do IPMA (capitais de distrito, outras cidades e ilhas), open-data sem chave (MOB-019).
export function useIpmaLocations() {
  return useQuery({
    queryKey: ['ipma', 'locations'],
    queryFn: () => ipmaClient.getLocations(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

// Previsão a 5 dias de um local, open-data do IPMA: a API Aberta só tem 3 dias (MOB-019).
export function useIpmaCityForecast(cityId: number | string) {
  return useQuery({
    queryKey: ['ipma', 'forecast', String(cityId)],
    queryFn: () => ipmaClient.getCityForecast(cityId),
    staleTime: 60 * 60 * 1000,
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

// Avisos meteorológicos ativos (amarelo/laranja/vermelho), open-data do IPMA, sem chave (WEB-025).
export function useIpmaWarnings() {
  return useQuery({
    queryKey: ['ipma', 'warnings'],
    queryFn: () => ipmaClient.getWarnings(),
    staleTime: 15 * 60 * 1000,
  })
}
