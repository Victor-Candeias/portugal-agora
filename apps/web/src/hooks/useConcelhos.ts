import { useQuery } from '@tanstack/react-query'
import {
  loadMunicipalitiesCached,
  loadMunicipalityParishesCached,
  MUNICIPALITIES_CACHE_TTL_MS,
  PARISHES_CACHE_TTL_MS,
  shouldRetryGeoApi,
  type KeyValueStorage,
} from '@portugal-hoje/core'
import { apiClient } from '@/lib/clients'

// localStorage pode não existir ou falhar (modo privado); nesse caso a lista vem sempre da API.
function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

// Concelhos da API Aberta (WEB-042): lista em cache persistente durante 30 dias.
export function useMunicipalities() {
  return useQuery({
    queryKey: ['apiaberta', 'geo', 'municipalities'],
    queryFn: () =>
      loadMunicipalitiesCached({
        fetchAll: () => apiClient.getMunicipalities().then(r => r.data),
        storage: browserStorage(),
      }),
    staleTime: MUNICIPALITIES_CACHE_TTL_MS,
    gcTime: Infinity,
  })
}

// Ficha com a fronteira (GeoJSON, ~30 KB): só em memória.
export function useMunicipality(slug: string | undefined) {
  return useQuery({
    queryKey: ['apiaberta', 'geo', 'municipality', slug],
    queryFn: () => apiClient.getMunicipality(slug!),
    enabled: !!slug,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  })
}

// Freguesias (geoapi.pt, WEB-049): limites simplificados em cache persistente durante 30 dias.
export function useMunicipalityParishes(codigoine: string | undefined) {
  return useQuery({
    queryKey: ['geoapi', 'parishes', codigoine],
    queryFn: () => loadMunicipalityParishesCached({ codigoine: codigoine!, storage: browserStorage() }),
    enabled: !!codigoine,
    staleTime: PARISHES_CACHE_TTL_MS,
    retry: shouldRetryGeoApi,
  })
}
