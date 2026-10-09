import { useQuery } from '@tanstack/react-query'
import { isValidPostalCode, normalizePostalCode, shouldRetryCodigoPostal, type CpInfo } from '@portugal-hoje/core'
import { codigoPostalClient } from '@/lib/clients'

// Lógica de dados em packages/core/src/api/codigoPostal.ts (MOB-002).
export type { CpParte, CpInfo } from '@portugal-hoje/core'

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
