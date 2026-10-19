import { useQuery } from '@tanstack/react-query'
import Storage from 'expo-sqlite/kv-store'
import {
  ENERGY_CACHE_FRESH_MS,
  loadEnergyDailyCached,
  loadEnergyLatestCached,
  shouldRetryEnergy,
} from '@portugal-hoje/core'
import { energyClient } from '../lib/clients'

// Energia (WEB-055): últimos 30 dias publicados (`daily.json`) em cache persistente (expo-sqlite/kv-store).
// Offline mostra a última cópia guardada (`offline: true`; antiguidade pelo `latest.intervalEndUtc`/`savedAt`).
export function useEnergy() {
  return useQuery({
    queryKey: ['energy', 'daily'],
    queryFn: () => loadEnergyDailyCached(energyClient, Storage),
    staleTime: ENERGY_CACHE_FRESH_MS,
    retry: shouldRetryEnergy,
  })
}

// Só o último dia (`latest.json`, < 1 KB) para resumos.
export function useEnergyLatest() {
  return useQuery({
    queryKey: ['energy', 'latest'],
    queryFn: () => loadEnergyLatestCached(energyClient, Storage),
    staleTime: ENERGY_CACHE_FRESH_MS,
    retry: shouldRetryEnergy,
  })
}
