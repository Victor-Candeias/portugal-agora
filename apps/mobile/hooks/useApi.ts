import { useQuery } from '@tanstack/react-query'
import type { FuelType } from '@portugal-hoje/core'
import { apiClient } from '../lib/api'
import { dgegClient, DGEG_FUEL_IDS } from '@portugal-hoje/core'

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

export function useWeatherForecast(municipality?: string) {
  return useQuery({
    queryKey: ['weather', 'forecast', municipality],
    queryFn: () => apiClient.getWeatherForecast({ municipality, days: 5 }),
    staleTime: 60 * 60 * 1000,
    enabled: !!municipality,
  })
}

export function useEvStations(lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['ev', 'stations', lat, lng],
    queryFn: () => apiClient.getEvStations({ lat, lng, radius: 5, limit: 50 }),
    staleTime: 2 * 60 * 1000,
    enabled: !!(lat && lng),
  })
}

export function useCivilProtectionAlerts() {
  return useQuery({
    queryKey: ['anpc', 'alerts'],
    queryFn: () => apiClient.getCivilProtectionAlerts(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useEconomicIndicators() {
  return useQuery({
    queryKey: ['economy', 'indicators'],
    queryFn: () => apiClient.getEconomicIndicators({ limit: 10 }),
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
