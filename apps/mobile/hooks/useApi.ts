import { useQuery } from '@tanstack/react-query'
import type { FuelType } from '@portugal-hoje/core'
import { apiClient } from '../lib/api'

export function useFuelPrices(fuelType: FuelType, district?: string) {
  return useQuery({
    queryKey: ['fuel', 'prices', fuelType, district],
    queryFn: () => apiClient.getCheapestFuel({ fuel_type: fuelType, district, limit: 30 }),
    staleTime: 60 * 60 * 1000,
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
