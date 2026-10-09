import { useQuery } from '@tanstack/react-query'
import { publicServicesClient } from '../lib/clients'

export function usePublicServicesMeta() {
  return useQuery({
    queryKey: ['public-services', 'meta'],
    queryFn: () => publicServicesClient.getDbMeta(),
    staleTime: Infinity,
  })
}

export function usePublicServices() {
  return useQuery({
    queryKey: ['public-services', 'list'],
    queryFn: () => publicServicesClient.getAll(),
    staleTime: Infinity,
  })
}
