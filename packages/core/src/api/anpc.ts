// ANPC / Proteção Civil (ocorrências via API Aberta) — cliente agnóstico de plataforma (MOB-002).
// A API key é injetada por cada app (web: VITE_APIABERTA_KEY, mobile: EXPO_PUBLIC_APIABERTA_KEY).
export const ANPC_BASE_URL = 'https://api.apiaberta.pt/v1'

export interface AnpcIncident {
  id: string
  date: string
  datetime: string
  type: string
  type_code: string
  status: string
  active: boolean
  location: {
    district: string
    freguesia: string
    address: string
    region: string
    subregion: string
    lat: number
    lng: number
  }
  resources: {
    ground: number
    aerial: number
    water: number
  }
}

export interface AnpcSummary {
  total_active: number
  as_of: string
  by_district: { district: string; count: number }[]
  by_type: { type: string; count: number }[]
}

export interface AnpcIncidentsResponse {
  count: number
  as_of: string
  data: AnpcIncident[]
}

export interface AnpcClientOptions {
  apiKey: string
  baseUrl?: string
}

export function createAnpcClient(options: AnpcClientOptions) {
  const baseUrl = options.baseUrl ?? ANPC_BASE_URL

  async function apiFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'X-API-Key': options.apiKey },
    })
    if (!res.ok) throw new Error(`ANPC API: ${res.status}`)
    return res.json() as Promise<T>
  }

  return {
    getIncidents: () => apiFetch<AnpcIncidentsResponse>('/anpc/incidents'),
    getSummary: () => apiFetch<AnpcSummary>('/anpc/summary'),
  }
}

export type AnpcClient = ReturnType<typeof createAnpcClient>
