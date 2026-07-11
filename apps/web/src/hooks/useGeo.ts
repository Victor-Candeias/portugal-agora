import { useQuery } from '@tanstack/react-query'
import { dgegClient } from '@portugal-hoje/core'

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
