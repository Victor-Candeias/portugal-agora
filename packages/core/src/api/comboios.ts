// Comboios CP (comboios.live) — cliente agnóstico de plataforma (MOB-002).
// comboios.live não envia cabeçalhos CORS: no nativo usa-se o host direto (omissão); a app web
// injeta um `baseUrl` via proxy (Vite em dev, corsproxy.io em produção).
export const COMBOIOS_BASE_URL = 'https://comboios.live'

export interface Train {
  agencyId: string
  trainNumber: number
  runDate: string
  delay: number           // seconds (positive = late, negative = early)
  status: 'IN_TRANSIT' | 'AT_STATION' | 'AT_ORIGIN' | 'NEAR_NEXT'
  hasDisruptions: boolean
  lastStation: string
  latitude: string
  longitude: string
  lastStationPlatform: string
  bearing: number
  gtfs?: {
    tripId: string
    stopId: string
    stopIdWithPlatform: string
    stopSequence: number
  }
  skippedStops: string[]
  service: { code: string; designation: string }
  origin: { code: string; designation: string }
  destination: { code: string; designation: string }
  timestamp: number
}

export interface Station {
  code: string
  designation: string
  latitude: string
  longitude: string
  railways: string[]
}

export interface ComboiosClientOptions {
  baseUrl?: string
}

export function createComboiosClient(options: ComboiosClientOptions = {}) {
  const baseUrl = options.baseUrl ?? COMBOIOS_BASE_URL

  return {
    /** Comboios em circulação, ordenados por atraso (maior primeiro). */
    async getTrains(): Promise<Train[]> {
      const res = await fetch(`${baseUrl}/api/vehicles`)
      if (!res.ok) throw new Error(`Erro ao carregar comboios (HTTP ${res.status})`)
      const data = (await res.json()) as { vehicles: Train[] }
      return data.vehicles.sort((a, b) => b.delay - a.delay)
    },

    async getStations(): Promise<Station[]> {
      const res = await fetch(`${baseUrl}/api/stations`)
      if (!res.ok) throw new Error('Erro ao carregar estações')
      const data = (await res.json()) as { stations: Station[] }
      return data.stations
    },
  }
}

export type ComboiosClient = ReturnType<typeof createComboiosClient>

/** Cliente com `fetch` direto (sem proxy) — adequado para apps nativas. */
export const comboiosClient = createComboiosClient()
