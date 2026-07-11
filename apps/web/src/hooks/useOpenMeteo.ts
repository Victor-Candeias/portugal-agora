import { useQuery } from '@tanstack/react-query'

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'
const GEO_BASE = 'https://geocoding-api.open-meteo.com/v1/search'

// WMO weather interpretation codes → descrição PT + emoji
const WMO_CODES: Record<number, { desc: string; emoji: string }> = {
  0:  { desc: 'Céu limpo',                 emoji: '☀️' },
  1:  { desc: 'Maioritariamente limpo',     emoji: '🌤️' },
  2:  { desc: 'Parcialmente nublado',       emoji: '⛅' },
  3:  { desc: 'Nublado',                   emoji: '☁️' },
  45: { desc: 'Nevoeiro',                  emoji: '🌫️' },
  48: { desc: 'Nevoeiro com geada',        emoji: '🌫️' },
  51: { desc: 'Chuvisco fraco',            emoji: '🌦️' },
  53: { desc: 'Chuvisco moderado',         emoji: '🌦️' },
  55: { desc: 'Chuvisco forte',            emoji: '🌧️' },
  61: { desc: 'Chuva fraca',              emoji: '🌦️' },
  63: { desc: 'Chuva moderada',           emoji: '🌧️' },
  65: { desc: 'Chuva forte',              emoji: '🌧️' },
  71: { desc: 'Neve fraca',               emoji: '❄️' },
  73: { desc: 'Neve moderada',            emoji: '❄️' },
  75: { desc: 'Neve forte',               emoji: '❄️' },
  77: { desc: 'Granizo',                  emoji: '🌨️' },
  80: { desc: 'Aguaceiros fracos',         emoji: '🌦️' },
  81: { desc: 'Aguaceiros moderados',      emoji: '🌧️' },
  82: { desc: 'Aguaceiros fortes',         emoji: '🌧️' },
  85: { desc: 'Aguaceiros de neve',        emoji: '🌨️' },
  86: { desc: 'Aguaceiros de neve fortes', emoji: '🌨️' },
  95: { desc: 'Trovoada',                 emoji: '⛈️' },
  96: { desc: 'Trovoada com granizo',      emoji: '⛈️' },
  99: { desc: 'Trovoada forte com granizo',emoji: '⛈️' },
}

export function getWmoDescription(code: number) {
  return WMO_CODES[code] ?? { desc: 'Sem informação', emoji: '🌤️' }
}

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
