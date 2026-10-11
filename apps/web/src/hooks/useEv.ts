import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DEFAULT_EV_CHARGE_SETTINGS,
  EV_CHARGE_STORAGE_KEY,
  parseEvChargeSettings,
  shouldRetryOpenChargeMap,
  type EvChargeSettings,
  type NearbyEvChargersParams,
} from '@portugal-hoje/core'
import { apiClient, openChargeMapClient } from '@/lib/clients'

// Bateria e percentagens do cálculo de custo por posto (WEB-043), guardadas no localStorage.
function readChargeSettings(): EvChargeSettings {
  try {
    return parseEvChargeSettings(window.localStorage.getItem(EV_CHARGE_STORAGE_KEY))
  } catch {
    return DEFAULT_EV_CHARGE_SETTINGS
  }
}

export function useEvChargeSettings() {
  const [settings, setSettings] = useState<EvChargeSettings>(readChargeSettings)
  useEffect(() => {
    try {
      window.localStorage.setItem(EV_CHARGE_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Sem localStorage (modo privado): fica só em memória.
    }
  }, [settings])
  const update = (patch: Partial<EvChargeSettings>) => setSettings(prev => ({ ...prev, ...patch }))
  return [settings, update] as const
}

// Tarifas de carregamento dos CEME (API Aberta /ev).
export function useEvTariffs() {
  return useQuery({
    queryKey: ['ev', 'tariffs'],
    queryFn: () => apiClient.getEvTariffs(),
    staleTime: 15 * 60 * 1000,
  })
}

// Custo de um carregamento de `kwh` por CEME, do mais barato para o mais caro.
export function useCheapestEvTariffs(kwh: number) {
  return useQuery({
    queryKey: ['ev', 'cheapest', kwh],
    queryFn: () => apiClient.getCheapestEvTariffs(kwh),
    enabled: kwh > 0,
    staleTime: 15 * 60 * 1000,
  })
}

// Postos de carregamento perto de um ponto (Open Charge Map, WEB-040). As coordenadas entram na
// chave arredondadas (~100 m) para não repetir o pedido por pequenas variações do GPS.
export function useEvChargers(params: NearbyEvChargersParams | null) {
  return useQuery({
    queryKey: [
      'ev', 'chargers',
      params?.latitude.toFixed(3), params?.longitude.toFixed(3), params?.radiusKm, params?.minPowerKw ?? 0,
    ],
    queryFn: () => openChargeMapClient.getNearbyChargers(params!),
    enabled: params !== null,
    staleTime: 10 * 60 * 1000,
    retry: shouldRetryOpenChargeMap,
  })
}
