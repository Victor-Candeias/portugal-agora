import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { FuelType } from '@portugal-hoje/core'
import {
  dgegClient,
  DGEG_FUEL_IDS,
  DEFAULT_FUEL_TANK_LITRES,
  FUEL_TANK_STORAGE_KEY,
  parseTankLitres,
} from '@portugal-hoje/core'

export function useFuelPrices(fuelType: FuelType, districtId?: number, municipalityId?: number) {
  return useQuery({
    queryKey: ['fuel', 'prices', fuelType, districtId ?? 'all', municipalityId ?? 'all'],
    queryFn: async () => {
      const fuelTypeId = DGEG_FUEL_IDS[fuelType]
      if (!fuelTypeId) throw new Error(`Tipo de combustível desconhecido: ${fuelType}`)
      const stations = await dgegClient.searchStations({
        fuelTypeId,
        districtId,
        municipalityId,
        pageSize: 9999,
      })
      return stations.sort((a, b) => a.price_eur - b.price_eur)
    },
    staleTime: 60 * 60 * 1000,
  })
}

// Litros do depósito para o custo de atestar (WEB-045), guardados no localStorage quando válidos.
function readTankLitres(): string {
  try {
    const stored = window.localStorage.getItem(FUEL_TANK_STORAGE_KEY)
    return parseTankLitres(stored) !== null ? stored! : String(DEFAULT_FUEL_TANK_LITRES)
  } catch {
    return String(DEFAULT_FUEL_TANK_LITRES)
  }
}

export function useFuelTankLitres() {
  const [text, setText] = useState(readTankLitres)
  useEffect(() => {
    if (parseTankLitres(text) === null) return
    try {
      window.localStorage.setItem(FUEL_TANK_STORAGE_KEY, text)
    } catch {
      // Sem localStorage (modo privado): fica só em memória.
    }
  }, [text])
  return [text, setText] as const
}
