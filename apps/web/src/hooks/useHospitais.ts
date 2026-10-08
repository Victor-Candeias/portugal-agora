import { useQuery } from '@tanstack/react-query'
import { snsClient } from '@/lib/clients'

// Lógica de dados em packages/core/src/api/sns.ts (MOB-002).
export type { Valencia, Hospital, Atendimento } from '@portugal-hoje/core'

/** Devolve todos os hospitais agrupados por serviço de urgência */
export function useHospitaisValencias() {
  return useQuery({
    queryKey: ['sns', 'valencias'],
    queryFn: () => snsClient.getHospitals(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

/** Últimos 12 meses de atendimentos (≈400 registos) */
export function useHospitaisAtendimentos() {
  return useQuery({
    queryKey: ['sns', 'atendimentos', 'recent'],
    queryFn: () => snsClient.getAtendimentos(12),
    staleTime: 24 * 60 * 60 * 1000,
  })
}
