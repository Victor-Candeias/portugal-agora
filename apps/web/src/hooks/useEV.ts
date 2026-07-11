import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

export function useEvStations(lat?: number, lng?: number, radius = 5) {
  return useQuery({
    queryKey: ['ev', 'stations', lat, lng, radius],
    queryFn: () => apiClient.getEvStations({ lat, lng, radius, limit: 100 }),
    staleTime: 2 * 60 * 1000, // 2 minutes — state changes frequently
    enabled: !!(lat && lng),
  })
}
