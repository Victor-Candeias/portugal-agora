// Serviços Públicos (PSP/GNR/Polícia) — queries sobre o `.sqlite` estático gerado a partir do
// OpenStreetMap Overpass API (apps/web/scripts/build-public-services-db.mjs, WEB-023).
// Agnóstico de plataforma (MOB-002): o motor SQLite é injetado via `QueryAll`.
import type { QueryAll } from '../sqlite.js'
import { getStaticDbMeta } from '../sqlite.js'

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

export interface PublicServicesClientOptions {
  queryAll: QueryAll
}

export function createPublicServicesClient(options: PublicServicesClientOptions) {
  const { queryAll } = options

  return {
    getDbMeta: () => getStaticDbMeta(queryAll),

    getAll(): Promise<PublicService[]> {
      return queryAll<PublicService>(
        `SELECT id, category, subcategory, name, address, postal_code, locality, municipality,
                latitude, longitude, phone, email, website, opening_hours, operator, confidence
         FROM public_services
         ORDER BY name`,
      )
    },
  }
}

export type PublicServicesClient = ReturnType<typeof createPublicServicesClient>
