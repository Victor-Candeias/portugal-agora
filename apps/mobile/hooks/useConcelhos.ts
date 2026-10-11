import { useQuery } from '@tanstack/react-query'
import Storage from 'expo-sqlite/kv-store'
import { loadMunicipalitiesCached, MUNICIPALITIES_CACHE_TTL_MS } from '@portugal-hoje/core'
import { apiClient } from '../lib/api'

// Concelhos da API Aberta (WEB-042): lista em cache persistente (expo-sqlite/kv-store) durante 30 dias.
export function useMunicipalities() {
  return useQuery({
    queryKey: ['apiaberta', 'geo', 'municipalities'],
    queryFn: () =>
      loadMunicipalitiesCached({
        fetchAll: () => apiClient.getMunicipalities().then(r => r.data),
        storage: Storage,
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
