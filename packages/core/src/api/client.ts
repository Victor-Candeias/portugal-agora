import type {
  FuelType,
  FuelPrice,
  FuelStation,
  WeatherForecast,
  WeatherObservation,
  EvStation,
  CivilProtectionAlert,
  FireRisk,
  EconomicIndicator,
  InterestRate,
} from '../types/index.js'

export interface GeoDistrict {
  _id: string
  name: string
  codigoine: string
}

export interface GeoMunicipality {
  _id: string
  name: string
  slug: string
  district: string
  codigoine: string
  coords: { lat: number; lng: number } | null
}

export interface ApiClientOptions {
  apiKey: string
  baseUrl?: string
}

interface ListResponse<T> {
  meta: { page: number; limit: number; total: number; pages: number }
  data: T[]
}
interface SingleResponse<T> {
  data: T
}

export class ApiAbertaClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.apiaberta.pt/v1'
    this.headers = {
      'X-API-Key': options.apiKey,
      'Content-Type': 'application/json',
    }
  }

  private async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, String(v))
      })
    }
    const res = await fetch(url.toString(), { headers: this.headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new ApiError(res.status, (err as any).message ?? res.statusText)
    }
    return res.json() as Promise<T>
  }

  // ── Fuel ─────────────────────────────────────────────────────────────────
  async getFuelPrices(params?: {
    fuel_type?: FuelType
    district?: string
    municipality?: string
    page?: number
    limit?: number
  }): Promise<ListResponse<FuelPrice>> {
    return this.get('/fuel/prices', params as any)
  }

  async getCheapestFuel(params: {
    fuel_type: FuelType
    district?: string
    lat?: number
    lng?: number
    limit?: number
  }): Promise<ListResponse<FuelPrice>> {
    return this.get('/fuel/cheapest', params as any)
  }

  async getFuelStations(params?: {
    district?: string
    lat?: number
    lng?: number
    radius?: number
    page?: number
    limit?: number
  }): Promise<ListResponse<FuelStation>> {
    return this.get('/fuel/stations', params as any)
  }

  // ── Weather ───────────────────────────────────────────────────────────────
  async getWeatherForecast(params: {
    municipality?: string
    lat?: number
    lng?: number
    days?: number
  }): Promise<ListResponse<WeatherForecast>> {
    return this.get('/weather/forecast', params as any)
  }

  async getWeatherObservation(params?: {
    lat?: number
    lng?: number
    station?: string
  }): Promise<SingleResponse<WeatherObservation>> {
    return this.get('/weather/observations', params as any)
  }

  // ── EV ───────────────────────────────────────────────────────────────────
  async getEvStations(params?: {
    lat?: number
    lng?: number
    radius?: number
    status?: string
    page?: number
    limit?: number
  }): Promise<ListResponse<EvStation>> {
    return this.get('/ev/stations', params as any)
  }

  // ── Civil Protection ──────────────────────────────────────────────────────
  async getCivilProtectionAlerts(params?: {
    district?: string
    severity?: string
  }): Promise<ListResponse<CivilProtectionAlert>> {
    return this.get('/civil-protection/alerts', params as any)
  }

  async getFireRisk(params?: {
    district?: string
  }): Promise<ListResponse<FireRisk>> {
    return this.get('/civil-protection/fire-risk', params as any)
  }

  // ── Economy ───────────────────────────────────────────────────────────────
  async getEconomicIndicators(params?: {
    page?: number
    limit?: number
  }): Promise<ListResponse<EconomicIndicator>> {
    return this.get('/statistics/indicators', params as any)
  }

  async getInterestRates(): Promise<ListResponse<InterestRate>> {
    return this.get('/finance/rates')
  }

  // ── Geo ───────────────────────────────────────────────────────────────────
  async getDistricts(): Promise<{ count: number; data: GeoDistrict[] }> {
    return this.get('/geo/districts')
  }

  async getMunicipalities(): Promise<ListResponse<GeoMunicipality>> {
    return this.get('/geo/municipalities', { limit: 400 })
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
