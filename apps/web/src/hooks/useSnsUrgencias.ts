import { useQuery } from '@tanstack/react-query'
import { shouldRetrySnsUrgencias } from '@portugal-hoje/core'
import { snsUrgenciasClient } from '@/lib/clients'

// O coletor publica 1×/dia: acima disto volta a pedir os JSON (revalidados pelo ETag do Pages).
const SNS_URGENCIAS_STALE_MS = 30 * 60 * 1000

// Urgências do SNS (WEB-067): observações dos últimos 90 dias (`series.json` expandido).
export function useSnsUrgenciasObservations() {
  return useQuery({
    queryKey: ['sns-urgencias', 'observations'],
    queryFn: () => snsUrgenciasClient.getObservations(),
    staleTime: SNS_URGENCIAS_STALE_MS,
    retry: shouldRetrySnsUrgencias,
  })
}

// Indicadores, regiões, unidades, fonte e licença (`metadata.json`).
export function useSnsUrgenciasMetadata() {
  return useQuery({
    queryKey: ['sns-urgencias', 'metadata'],
    queryFn: () => snsUrgenciasClient.getMetadata(),
    staleTime: SNS_URGENCIAS_STALE_MS,
    retry: shouldRetrySnsUrgencias,
  })
}

// Estado da última sincronização (`status.json`); sem ficheiro a página só não mostra a sincronização.
export function useSnsUrgenciasStatus() {
  return useQuery({
    queryKey: ['sns-urgencias', 'status'],
    queryFn: () => snsUrgenciasClient.getStatus(),
    staleTime: SNS_URGENCIAS_STALE_MS,
    retry: shouldRetrySnsUrgencias,
  })
}
