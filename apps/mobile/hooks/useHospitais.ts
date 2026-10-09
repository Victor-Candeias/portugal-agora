import { useQuery } from '@tanstack/react-query'
import { snsClient } from '../lib/clients'

/** Hospitais agrupados por serviço de urgência (SNS — Portal da Transparência). */
export function useHospitals() {
  return useQuery({
    queryKey: ['sns', 'valencias'],
    queryFn: () => snsClient.getHospitals(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}
