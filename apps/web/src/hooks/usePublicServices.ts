// Hooks React Query para Serviços Públicos (PSP/GNR/Polícia), consultando o `.sqlite`
// estático (WASM) gerado em build/CI a partir do OpenStreetMap Overpass API
// (ver publicServicesDb.ts, scripts/build-public-services-db.mjs, WEB-023).
import { useQuery } from '@tanstack/react-query'
import { publicServicesQueryAll, getPublicServicesDbMeta } from '@/lib/publicServicesDb'

export interface PublicService {
  id: string
  category: string
  subcategory: string | null
  name: string
  address: string | null
  postal_code: string | null
  locality: string | null
  municipality: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  website: string | null
  opening_hours: string | null
  operator: string | null
  confidence: number
}

export const PUBLIC_SERVICE_CATEGORIES = [
  { value: 'police_psp', label: 'PSP' },
  { value: 'police_gnr', label: 'GNR' },
  { value: 'police_municipal', label: 'Polícia Municipal' },
  { value: 'police_maritime', label: 'Polícia Marítima' },
  { value: 'police_other', label: 'Outra' },
] as const

export function usePublicServicesMeta() {
  return useQuery({
    queryKey: ['public-services', 'meta'],
    queryFn: getPublicServicesDbMeta,
    staleTime: Infinity,
  })
}

export function usePublicServices() {
  return useQuery({
    queryKey: ['public-services', 'list'],
    queryFn: () => publicServicesQueryAll<PublicService>(
      `SELECT id, category, subcategory, name, address, postal_code, locality, municipality,
              latitude, longitude, phone, email, website, opening_hours, operator, confidence
       FROM public_services
       ORDER BY name`,
    ),
    staleTime: Infinity,
  })
}
