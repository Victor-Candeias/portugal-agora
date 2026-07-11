import { useQuery } from '@tanstack/react-query'
import type { FuelType } from '@portugal-hoje/core'
import { dgegClient, DGEG_FUEL_IDS } from '@portugal-hoje/core'

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
