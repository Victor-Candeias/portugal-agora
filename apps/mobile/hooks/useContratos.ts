import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import type { BaseContract, BaseContractsPage } from '@portugal-hoje/core'
import { apiClient } from '../lib/api'

const PAGE_SIZE = 25

// Contratos públicos do BASE (WEB-031): sem `query`, os mais recentes; com `query`, a pesquisa de
// texto/entidade/NIF. "Mostrar mais" pede a página seguinte.
export function useBaseContracts(query: string | null) {
  return useInfiniteQuery({
    queryKey: ['base', 'contracts', query ?? ''],
    queryFn: ({ pageParam }) =>
      query
        ? apiClient.searchBaseContracts({ q: query, page: pageParam, limit: PAGE_SIZE })
        : apiClient.getBaseContracts({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: last => (last.page < last.pages ? last.page + 1 : undefined),
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
  const cached = queryClient.getQueriesData<InfiniteData<BaseContractsPage>>({ queryKey: ['base', 'contracts'] })
  for (const [, data] of cached) {
    for (const page of data?.pages ?? []) {
      const found = page.data.find(c => c.id === id)
      if (found) return found
    }
  }
  return undefined
}
