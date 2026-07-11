import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

export function useWeatherForecast(municipality?: string, lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['weather', 'forecast', municipality ?? lat],
    queryFn: () => apiClient.getWeatherForecast({ municipality, lat, lng, days: 5 }),
    staleTime: 60 * 60 * 1000,
    enabled: !!(municipality || lat),
  })
}

export function useWeatherObservation(lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['weather', 'observation', lat, lng],
    queryFn: () => apiClient.getWeatherObservation({ lat, lng }),
    staleTime: 30 * 60 * 1000,
    enabled: !!(lat && lng),
  })
}
