// Hooks React Query para Serviços Públicos (PSP/GNR/Polícia). As queries ao `.sqlite` estático
// (OSM Overpass, WEB-023) vivem em packages/core/src/api/publicServices.ts (MOB-002); o motor
// SQLite (sql.js/WASM) é injetado em src/lib/clients.ts.
import { useQuery } from '@tanstack/react-query'
import { publicServicesClient } from '@/lib/clients'

export type { PublicService } from '@portugal-hoje/core'
export { PUBLIC_SERVICE_CATEGORIES } from '@portugal-hoje/core'

export function usePublicServicesMeta() {
  return useQuery({
    queryKey: ['public-services', 'meta'],
    queryFn: () => publicServicesClient.getDbMeta(),
    staleTime: Infinity,
  })
}

export function usePublicServices() {
  return useQuery({
    queryKey: ['public-services', 'list'],
    queryFn: () => publicServicesClient.getAll(),
    staleTime: Infinity,
  })
}
