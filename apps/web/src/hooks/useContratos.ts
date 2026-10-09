import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { BaseContract, BaseContractsPage } from '@portugal-hoje/core'
import { apiClient } from '@/lib/clients'

export const CONTRACTS_PAGE_SIZE = 25

// Contratos públicos do BASE (WEB-031): sem `query`, os mais recentes; com `query`, a pesquisa de texto/entidade/NIF.
export function useBaseContracts(query: string | null, page: number) {
  return useQuery({
    queryKey: ['base', 'contracts', query ?? '', page],
    queryFn: () =>
      query
        ? apiClient.searchBaseContracts({ q: query, page, limit: CONTRACTS_PAGE_SIZE })
        : apiClient.getBaseContracts({ page, limit: CONTRACTS_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
  })
}

// Detalhe de um contrato. Se já veio numa lista, aparece logo enquanto o lookup responde.
export function useBaseContract(id: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['base', 'contract', id],
    queryFn: () => apiClient.getBaseContract(id!),
    enabled: !!id,
    placeholderData: () => (id ? findCachedContract(queryClient, id) : undefined),
    staleTime: 24 * 60 * 60 * 1000,
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })
}

function findCachedContract(queryClient: QueryClient, id: string): BaseContract | undefined {
  for (const [, page] of queryClient.getQueriesData<BaseContractsPage>({ queryKey: ['base', 'contracts'] })) {
    const found = page?.data.find(c => c.id === id)
    if (found) return found
  }
  return undefined
}
