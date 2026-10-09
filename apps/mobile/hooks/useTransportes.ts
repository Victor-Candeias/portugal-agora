import { useQuery } from '@tanstack/react-query'
import { comboiosClient, tmlClient } from '../lib/clients'

export function useTrains() {
  return useQuery({
    queryKey: ['cp', 'vehicles'],
    queryFn: () => comboiosClient.getTrains(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  })
}

export function useTrainStations() {
  return useQuery({
    queryKey: ['cp', 'stations'],
    queryFn: () => comboiosClient.getStations(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

export function useTmlAlerts() {
  return useQuery({
    queryKey: ['tml', 'alerts'],
    queryFn: () => tmlClient.getAlerts(),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
