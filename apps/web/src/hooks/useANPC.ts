import { useQuery } from '@tanstack/react-query'

const BASE = 'https://api.apiaberta.pt/v1'
const API_KEY = import.meta.env.VITE_APIABERTA_KEY ?? ''

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-API-Key': API_KEY },
  })
  if (!res.ok) throw new Error(`ANPC API: ${res.status}`)
  return res.json()
}

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

export function useAnpcIncidents() {
  return useQuery<{ count: number; as_of: string; data: AnpcIncident[] }>({
    queryKey: ['anpc', 'incidents'],
    queryFn: () => apiFetch('/anpc/incidents/active'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useAnpcSummary() {
  return useQuery<AnpcSummary>({
    queryKey: ['anpc', 'summary'],
    queryFn: () => apiFetch('/anpc/summary'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
