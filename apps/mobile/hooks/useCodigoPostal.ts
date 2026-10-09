import { useQuery } from '@tanstack/react-query'
import { isValidPostalCode, normalizePostalCode, shouldRetryCodigoPostal, type CpInfo } from '@portugal-hoje/core'
import { codigoPostalClient } from '../lib/clients'

export function useCodigoPostal(cp: string) {
  const normalized = normalizePostalCode(cp)
  return useQuery<CpInfo>({
    queryKey: ['cp', normalized],
    queryFn: () => codigoPostalClient.lookup(normalized),
    enabled: isValidPostalCode(normalized),
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: shouldRetryCodigoPostal,
  })
}
