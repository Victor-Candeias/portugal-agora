import type { FuelType, FuelPrice, FuelStation } from '../types/index.js'

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

export interface IpmaDailyForecast {
  date: string
  tMin: number
  tMax: number
  description: string
  precipProb: number
  windDir: string
  windSpeed: string
}

export interface IpmaCityForecast {
  cityId: number
  cityName: string
  district?: string
  latitude: string | number
  longitude: string | number
  forecasts: IpmaDailyForecast[]
}

export interface EvTariff {
  ceme: string
  tariff_type: 'fixed' | 'indexed'
  period_type: string
  activation_fee_eur: number
  notes?: string
  source_url?: string
  updated_at: string
  price_vazio_eur_kwh?: number
  price_normal_eur_kwh?: number
  current_price_eur_kwh?: number | null
  current_omie_eur_kwh?: number | null
  note?: string
}

export interface EvChargeCost {
  ceme: string
  price_per_kwh_eur: number
  energy_cost_eur: number
  activation_fee_eur: number
  total_cost_eur: number
  period: string
}

export interface BdpRate {
  key: string
  label: string
  label_pt: string
  value: number
  unit: string
  ref_date: string
  frequency: string
}

export interface BdpRatesResponse {
  source: string
  source_url: string
  count: number
  synced_at: string
  data: BdpRate[]
}

export interface IneIndicator {
  indicator: string
  label: string
  unit: string
  year: number
  value: number
}

interface ListResponse<T> {
  meta: { page: number; limit: number; total: number; pages: number }
  data: T[]
}

export class ApiAbertaClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly headers: Record<string, string>

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.apiaberta.pt/v1'
    this.apiKey = options.apiKey.trim()
    this.headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  private async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    if (!this.apiKey) {
      throw new ApiError(401, 'Chave da API Aberta em falta (definir *_APIABERTA_KEY no .env)')
    }
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

  // ── IPMA (previsão por capital de distrito, ~3 dias) ─────────────────────
  async getIpmaForecasts(): Promise<{ cities: number; data: IpmaCityForecast[] }> {
    return this.get('/ipma/forecasts')
  }

  async getIpmaForecast(cityId: number | string): Promise<IpmaCityForecast> {
    return this.get(`/ipma/forecasts/${cityId}`)
  }

  // ── EV (tarifas de carregamento CEME) ────────────────────────────────────
  async getEvTariffs(params?: { type?: 'fixed' | 'indexed' }): Promise<{
    data: EvTariff[]
    meta: { current_time: string; current_hour: number; current_omie_price_kwh?: number | null }
  }> {
    return this.get('/ev/tariffs', params)
  }

  async getCheapestEvTariffs(kwh: number): Promise<{
    data: EvChargeCost[]
    meta: { kwh_requested: number; current_time: string; current_period: string; note?: string }
  }> {
    return this.get('/ev/tariffs/cheapest', { kwh })
  }

  // ── Banco de Portugal ─────────────────────────────────────────────────────
  async getBdpRates(): Promise<BdpRatesResponse> {
    return this.get('/bdp/rates')
  }

  async getBdpLendingRates(): Promise<BdpRatesResponse> {
    return this.get('/bdp/lending-rates')
  }

  // ── INE / Eurostat ────────────────────────────────────────────────────────
  async getIneLatest(): Promise<{ source: string; fetched_at: string; data: IneIndicator[] }> {
    return this.get('/ine/latest')
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
