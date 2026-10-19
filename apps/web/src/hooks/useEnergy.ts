import { useQuery } from '@tanstack/react-query'
import {
  ENERGY_CACHE_FRESH_MS,
  ENERGY_INTRADAY_CACHE_FRESH_MS,
  loadEnergyDailyCached,
  loadEnergyIntradayCached,
  loadEnergyLatestCached,
  shouldRetryEnergy,
  type EnergyIntradayRange,
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

// Série horária ENTSO-E (WEB-058): 24 h ou 7 dias, publicada de hora a hora. Sem série publicada
// (404) a página continua só com o balanço diário.
export function useEnergyIntraday(range: EnergyIntradayRange, enabled = true) {
  return useQuery({
    queryKey: ['energy', 'intraday', range],
    queryFn: () => loadEnergyIntradayCached(energyClient, range, browserStorage()),
    staleTime: ENERGY_INTRADAY_CACHE_FRESH_MS,
    refetchInterval: ENERGY_INTRADAY_CACHE_FRESH_MS,
    retry: shouldRetryEnergy,
    enabled,
  })
}

// Estado do pipeline e reconciliação REN × ENTSO-E (WEB-060, `status.json`). Sem cache persistente:
// só interessa o estado atual; sem ficheiro (404) ou offline o cartão não aparece.
export function useEnergyStatus() {
  return useQuery({
    queryKey: ['energy', 'status'],
    queryFn: () => energyClient.getStatus(),
    staleTime: ENERGY_INTRADAY_CACHE_FRESH_MS,
    retry: shouldRetryEnergy,
  })
}