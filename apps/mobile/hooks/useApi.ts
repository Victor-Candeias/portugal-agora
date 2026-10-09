import { useQuery } from '@tanstack/react-query'
import type { FuelType } from '@portugal-hoje/core'
import { dgegClient, DGEG_FUEL_IDS, tourismClient, getWikidataEnrichment } from '@portugal-hoje/core'

export function useFuelPrices(fuelType: FuelType, districtId?: number, municipalityId?: number) {
  return useQuery({
    queryKey: ['fuel', 'prices', fuelType, districtId ?? 'all', municipalityId ?? 'all'],
    queryFn: async () => {
      const fuelTypeId = DGEG_FUEL_IDS[fuelType]
      if (!fuelTypeId) throw new Error(`Tipo de combustível desconhecido: ${fuelType}`)
      const stations = await dgegClient.searchStations({
        fuelTypeId,
        districtId,
        municipalityId,
        pageSize: 9999,
      })
      return stations.sort((a, b) => a.price_eur - b.price_eur)
    },
    staleTime: 60 * 60 * 1000,
  })
}

export function useDistricts() {
  return useQuery({
    queryKey: ['dgeg', 'districts'],
    queryFn: () => dgegClient.getDistricts(),
    staleTime: Infinity,
    select: (data) => [...data].sort((a, b) => a.Descritivo.localeCompare(b.Descritivo, 'pt')),
  })
}

export function useMunicipalities(districtId?: number) {
  return useQuery({
    queryKey: ['dgeg', 'municipalities', districtId],
    queryFn: () => dgegClient.getMunicipalities(districtId!),
    enabled: !!districtId,
    staleTime: Infinity,
    select: (data) => [...data].sort((a, b) => a.Descritivo.localeCompare(b.Descritivo, 'pt')),
  })
}

export function useTourismPoints(lat?: number, lng?: number, category?: string) {
  return useQuery({
    queryKey: ['tourism', 'points', lat, lng, category ?? 'all'],
    queryFn: () => tourismClient.getTourismPoints({
      nearby: lat && lng ? { latitude: lat, longitude: lng, radiusKm: 25 } : undefined,
      category,
    }),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !!(lat && lng),
  })
}

// Enriquecimento on-demand (descrição + fotografia) via Wikidata/Wikimedia Commons, pedido só
// quando o utilizador expande um ponto (mesmo padrão da app web, ver WEB-021) — evita o
// problema N+1/rate-limit de enriquecer toda a listagem de uma vez.
export function useWikidataEnrichment(name: string, enabled: boolean) {
  return useQuery({
    queryKey: ['tourism', 'wikidata', name],
    queryFn: () => getWikidataEnrichment(name),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}
