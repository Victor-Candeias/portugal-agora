import { useQuery } from '@tanstack/react-query'
import { getWmoDescription } from '@portugal-hoje/core'

export { getWmoDescription }

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'
const GEO_BASE = 'https://geocoding-api.open-meteo.com/v1/search'

export interface OpenMeteoForecastDay {
  date: string
  tMin: number
  tMax: number
  precipitaProb: number
  weatherCode: number
  windSpeedMax: number
  windDirection: number
  desc: string
  emoji: string
}

export interface OpenMeteoGeoResult {
  id: number
  name: string
  latitude: number
  longitude: number
  admin1?: string
  admin2?: string
}

async function geocodeMunicipality(name: string): Promise<OpenMeteoGeoResult | null> {
  const url = new URL(GEO_BASE)
  url.searchParams.set('name', name)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'pt')
  url.searchParams.set('format', 'json')
  url.searchParams.set('countryCode', 'PT')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Geocoding error: ${res.status}`)
  const json = await res.json()
  return json.results?.[0] ?? null
}

async function fetchForecast(lat: number, lng: number): Promise<OpenMeteoForecastDay[]> {
  const url = new URL(FORECAST_BASE)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lng))
  url.searchParams.set('daily', [
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max',
    'weathercode',
    'windspeed_10m_max',
    'winddirection_10m_dominant',
  ].join(','))
  url.searchParams.set('timezone', 'Europe/Lisbon')
  url.searchParams.set('forecast_days', '7')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)
  const json = await res.json()

  const d = json.daily
  return (d.time as string[]).map((date: string, i: number) => {
    const wmo = getWmoDescription(d.weathercode[i])
    return {
      date,
      tMin: Math.round(d.temperature_2m_min[i]),
      tMax: Math.round(d.temperature_2m_max[i]),
      precipitaProb: d.precipitation_probability_max[i] ?? 0,
      weatherCode: d.weathercode[i],
      windSpeedMax: Math.round(d.windspeed_10m_max[i]),
      windDirection: d.winddirection_10m_dominant[i],
      desc: wmo.desc,
      emoji: wmo.emoji,
    }
  })
}

export function useOpenMeteoGeocode(municipalityName?: string) {
  return useQuery({
    queryKey: ['openmeteo', 'geo', municipalityName],
    queryFn: () => geocodeMunicipality(municipalityName!),
    enabled: !!municipalityName,
    staleTime: Infinity,
  })
}

export function useOpenMeteoForecast(lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['openmeteo', 'forecast', lat, lng],
    queryFn: () => fetchForecast(lat!, lng!),
    enabled: lat !== undefined && lng !== undefined,
    staleTime: 60 * 60 * 1000,
  })
}
