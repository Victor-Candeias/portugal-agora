import { useQuery } from '@tanstack/react-query'
import { isCompanyNif } from '@portugal-hoje/core'
import { viesClient } from '@/lib/clients'

export const viesAvailable = viesClient !== null

// Nome e morada de empresas no VIES (WEB-041). Só consulta NIFs de empresas/entidades.
export function useViesLookup(nif: string | null) {
  const enabled = viesClient !== null && nif !== null && isCompanyNif(nif)
  return useQuery({
    queryKey: ['vies', nif],
    queryFn: () => viesClient!.lookup(nif!),
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}
