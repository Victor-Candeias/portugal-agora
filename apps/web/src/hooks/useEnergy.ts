import { useQuery } from '@tanstack/react-query'
import {
  ENERGY_CACHE_FRESH_MS,
  loadEnergyDailyCached,
  loadEnergyLatestCached,
  shouldRetryEnergy,
  type KeyValueStorage,
} from '@portugal-hoje/core'
import { energyClient } from '@/lib/clients'

// localStorage pode não existir ou falhar (modo privado); nesse caso os dados vêm sempre da rede.
function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

// Energia (WEB-055): últimos 30 dias publicados (`daily.json`) com cache persistente. Sem rede usa a
// última cópia guardada (`offline: true`, a antiguidade sai do `latest.intervalEndUtc`/`savedAt`).
export function useEnergy() {
  return useQuery({
    queryKey: ['energy', 'daily'],
    queryFn: () => loadEnergyDailyCached(energyClient, browserStorage()),
    staleTime: ENERGY_CACHE_FRESH_MS,
    retry: shouldRetryEnergy,
  })
}

// Só o último dia (`latest.json`, < 1 KB) para resumos.
export function useEnergyLatest() {
  return useQuery({
    queryKey: ['energy', 'latest'],
    queryFn: () => loadEnergyLatestCached(energyClient, browserStorage()),
    staleTime: ENERGY_CACHE_FRESH_MS,
    retry: shouldRetryEnergy,
  })
}
